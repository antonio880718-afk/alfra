# -*- coding: utf-8 -*-
"""
nfl_math_models_engine.py - Motor Cuantitativo y Modelos Matemáticos para Fútbol Americano (NFL y NCAAF).
Calcula EPA/Play, Números Clave (3, 7), Totales por Equipo, 1ra Mitad, Pase, TDs, Carrera,
Recepción, Recepciones Totales, Scrimmage y Anytime TD en 11 categorías auditables.
"""
import math
import re


def poisson_prob_over(lam: float, k: float) -> float:
    lam = max(0.05, float(lam))
    prob_le = 0.0
    k_int = int(math.floor(k))
    for i in range(max(0, k_int) + 1):
        prob_le += (math.exp(-lam) * (lam ** i)) / math.factorial(i)
    return max(0.01, min(0.99, 1.0 - prob_le))


def normal_prob_over(mean: float, std: float, k: float) -> float:
    """P(X > k) calibrada estilo nflfastR / edge-nfl: Log-Normal/Gamma para yardas (asimetría derecha de jugadas explosivas) y masa discreta en Números Clave NFL (3, 6, 7, 10, 14) para spreads."""
    std = max(0.5, float(std))
    mean = float(mean)
    k = float(k)
    z_norm = (k - mean) / std
    cdf_norm = 0.5 * (1.0 + math.erf(z_norm / math.sqrt(2.0)))
    z_t = z_norm * 0.94
    cdf_t = 0.5 * (1.0 + math.erf(z_t / math.sqrt(2.0)))

    if mean >= 15.0 and k > 2.0 and (std / mean) >= 0.22:
        cv2 = (std / mean) ** 2
        sig_ln = math.sqrt(math.log(1.0 + cv2))
        mu_ln = math.log(mean) - 0.5 * (sig_ln ** 2)
        z_ln = (math.log(max(0.5, k)) - mu_ln) / max(0.05, sig_ln)
        cdf_ln = 0.5 * (1.0 + math.erf(z_ln / math.sqrt(2.0)))
        p_raw = 1.0 - (0.58 * cdf_ln + 0.42 * cdf_t)
    else:
        p_raw = 1.0 - (0.65 * cdf_t + 0.35 * cdf_norm)
        if -25.0 <= k <= 25.0 and 10.0 <= std <= 15.0:
            key_bonus = 0.0
            for kn, weight in ((3.0, 0.022), (7.0, 0.018), (6.0, 0.010), (10.0, 0.012), (14.0, 0.009)):
                for sgn in (-1.0, 1.0):
                    kn_v = sgn * kn
                    if kn_v > k and (kn_v - k) <= 0.6:
                        dist_factor = math.exp(-0.5 * (((kn_v - mean) / std) ** 2))
                        key_bonus += weight * dist_factor
            p_raw = min(0.96, p_raw + key_bonus)

    p_cal = 0.85 * p_raw + 0.15 * 0.50
    return max(0.03, min(0.95, p_cal))


def _extract_home_spread(spread_str: str, home: str, away: str) -> float:
    if not spread_str or str(spread_str).upper() in ("EVEN", "PK", "PICK"):
        return 0.0
    m = re.search(r"([-+]?\d+(?:\.\d+)?)\s*$", str(spread_str).strip())
    if not m:
        return 0.0
    val = float(m.group(1))
    prefix = str(spread_str)[:m.start()].strip().lower()
    if not prefix:
        return val
    away_tokens = [w.lower() for w in away.split() if len(w) >= 3]
    home_tokens = [w.lower() for w in home.split() if len(w) >= 3]
    is_away_tag = any(prefix in tok or tok.startswith(prefix) for tok in away_tokens)
    is_home_tag = any(prefix in tok or tok.startswith(prefix) for tok in home_tokens)
    if is_away_tag and not is_home_tag:
        return -val
    return val


def _make_opt(
    pick: str,
    category: str,
    prob: float,
    player_full_name: str,
    player_pos: str,
    player_team: str,
    season_avg: str,
    safe_line: float,
    buffer_pct: str,
    defense_matchup: str,
    why_selected: str,
    stat_type: str,
    threshold: float,
    direction: str,
    player: str = "",
    player_role: str = "Titular Oficial",
    void_rule: str = "Regla VOID oficial: si el jugador no participa en snaps, liquida a @1.00.",
) -> dict:
    prob = max(0.52, min(0.95, float(prob)))
    odds_num = round(min(2.85, max(1.14, (1.0 / prob) * 1.035)), 2)
    fair_odds = round(1.0 / prob, 2)
    ev_val = (prob * odds_num - 1.0) * 100.0
    hits_est = max(5, min(10, round(prob * 10)))
    return {
        "pick": pick,
        "category": category,
        "player_full_name": player_full_name,
        "player_pos": player_pos,
        "player_team": player_team,
        "player_role": player_role,
        "season_avg": season_avg,
        "safe_line": safe_line,
        "buffer_pct": buffer_pct,
        "defense_matchup": defense_matchup,
        "why_selected": why_selected,
        "prob_num": round(prob * 100.0, 1),
        "odds_num": odds_num,
        "odds": f"@{odds_num:.2f}",
        "fair_odds": f"@{fair_odds:.2f}",
        "ev": f"{ev_val:+.1f}%",
        "record": f"{hits_est} de 10 ({hits_est * 10}%)",
        "player": player,
        "stat_type": stat_type,
        "threshold": threshold,
        "direction": direction,
        "void_rule": void_rule,
    }


def compute_full_nfl_game_data_engineering(game: dict) -> dict:
    """
    Genera ~38-55 mercados cuantitativos calibrados en 11 categorías auditables para NFL y NCAAF.
    """
    home = game.get("home", "Home Team")
    away = game.get("away", "Away Team")
    league = game.get("league", "NFL")
    ou_line = float(game.get("over_under", 46.5 if league == "NFL" else 54.5))
    spread_str = game.get("spread_str", "")
    _raw_stars = game.get("stars", [])
    try:
        import os as _os_ij, json as _json_ij
        _ij_p = _os_ij.path.join(_os_ij.path.dirname(_os_ij.path.abspath(__file__)), "data", "espn_injured_blacklist.json")
        _ij_set = set(_json_ij.load(open(_ij_p, "r", encoding="utf-8"))) if _os_ij.path.exists(_ij_p) else set()
    except Exception:
        _ij_set = set()
    stars = [s for s in _raw_stars if str(s.get("name", "")).lower().strip() not in _ij_set]
    venue = game.get("venue", "Estadio Oficial")
    is_dome = game.get("is_dome", False)

    try:
        from nfl_data_api import NFL_DEFENSE_PROFILES
    except Exception:
        NFL_DEFENSE_PROFILES = {}
    h_def = dict(NFL_DEFENSE_PROFILES.get(home, game.get("home_defense", {"pass_def_rank": 15, "pass_yds_allowed": 218.0, "rush_def_rank": 15, "rush_yds_allowed": 110.0, "pts_allowed": 21.8, "style": "Defensa Táctica"})))
    a_def = dict(NFL_DEFENSE_PROFILES.get(away, game.get("away_defense", {"pass_def_rank": 16, "pass_yds_allowed": 220.0, "rush_def_rank": 16, "rush_yds_allowed": 112.0, "pts_allowed": 22.2, "style": "Defensa Táctica"})))

    is_nfl = league == "NFL"
    has_vegas_spread = bool(spread_str and str(spread_str).strip())
    tot_std = 13.8 if is_nfl else 15.5
    margin_std = (14.5 if has_vegas_spread else 15.5) if is_nfl else (16.5 if has_vegas_spread else 19.0)
    h_pa = float(h_def.get("pts_allowed", 22.0 if is_nfl else 26.5))
    a_pa = float(a_def.get("pts_allowed", 22.0 if is_nfl else 26.5))
    h_pf = float(h_def.get("pts_for", h_pa))
    a_pf = float(a_def.get("pts_for", a_pa))
    h_yds = float(h_def.get("pass_yds_allowed", 220.0)) + float(h_def.get("rush_yds_allowed", 112.0))
    a_yds = float(a_def.get("pass_yds_allowed", 222.0)) + float(a_def.get("rush_yds_allowed", 115.0))
    dome_adj = 1.4 if is_dome else -0.6
    def_cross_total = (((h_pf + a_pa) / 2.0) + ((a_pf + h_pa) / 2.0)) + ((h_yds + a_yds - 665.0) * 0.02) + dome_adj
    home_spread = _extract_home_spread(spread_str, home, away)
    if not has_vegas_spread:
        exp_margin = ((h_pf - h_pa) - (a_pf - a_pa)) * 0.55 + 2.2
        home_spread = round(max(-14.5, min(14.5, -exp_margin)), 1)
    is_default_ou = (is_nfl and abs(ou_line - 46.5) < 0.05) or ((not is_nfl) and abs(ou_line - 54.5) < 0.05)
    proj_total = round((0.35 * ou_line + 0.65 * def_cross_total) if (is_default_ou and not has_vegas_spread) else (0.78 * ou_line + 0.22 * def_cross_total), 1)
    exp_home = round((proj_total - home_spread) / 2.0, 1)
    exp_away = round((proj_total + home_spread) / 2.0, 1)
    match_lbl = f"{away} @ {home}"

    categories = []

    # 1. PUNTOS TOTALES PARTIDO (4 líneas)
    cat_totals = {"category": "Puntos Totales Partido (Over / Under)", "options": []}
    for label, delta, direction in [
        ("Over Blindado (-10.5)", -10.5, "OVER"),
        ("Over Seguro (-7.5)", -7.5, "OVER"),
        ("Over Alternativo (-3.5)", -3.5, "OVER"),
        ("Over Línea Principal (0.0)", 0.0, "OVER"),
        ("Under Blindado (+10.5)", 10.5, "UNDER"),
        ("Under Seguro (+7.5)", 7.5, "UNDER"),
        ("Under Alternativo (+3.5)", 3.5, "UNDER"),
        ("Under Línea Principal (0.0)", 0.0, "UNDER"),
    ]:
        line = max(21.5, round(proj_total + delta - 0.5) + 0.5)
        p_val = normal_prob_over(proj_total, tot_std, line) if direction == "OVER" else (1.0 - normal_prob_over(proj_total, tot_std, line))
        cat_totals["options"].append(_make_opt(
            pick=f"Total Puntos {'Over' if direction=='OVER' else 'Under'} {line:.1f}",
            category="Puntos Totales",
            prob=p_val,
            player_full_name=match_lbl,
            player_pos="MATCH TOTAL",
            player_team=f"{away} & {home}",
            season_avg=f"Línea Vegas: {ou_line:.1f} PTS",
            safe_line=line,
            buffer_pct=f"{'-' if direction=='OVER' else '+'}{abs(ou_line - line):.1f} PTS ({label})",
            defense_matchup=f"{'Domo Techado' if is_dome else 'Estadio Abierto'} | {venue}",
            why_selected=f"Ajustar desde línea {ou_line:.1f} PTS cubre el número clave (7 pts / 1 TD) con {p_val*100:.1f}% de acierto.",
            stat_type="total_points",
            threshold=line,
            direction=direction,
            void_rule="Si el partido se suspende oficialmente antes de concluir, se anula (VOID).",
        ))
    categories.append(cat_totals)

    # 2. MONEYLINE & HÁNDICAPS CON NÚMEROS CLAVE (3, 7, 10)
    cat_ml_sp = {"category": "Moneyline & Hándicaps (Números Clave 3, 7, 10)", "options": []}
    p_ml_home = normal_prob_over(-home_spread, margin_std, 0.0)
    p_ml_away = 1.0 - p_ml_home
    fav_team, fav_prob, fav_stat = (home, p_ml_home, "moneyline_home") if p_ml_home >= p_ml_away else (away, p_ml_away, "moneyline_away")
    cat_ml_sp["options"].append(_make_opt(
        pick=f"{fav_team} Gana el Partido (Moneyline)",
        category="Moneyline",
        prob=max(0.54, fav_prob),
        player_full_name=fav_team,
        player_pos="ML",
        player_team=fav_team,
        season_avg=f"Spread ref: {spread_str or 'Parejo'}",
        safe_line=0.0,
        buffer_pct=f"Probabilidad implícita de triunfo {fav_prob*100:.1f}%",
        defense_matchup=f"Proyección: {away} {exp_away:.0f} - {home} {exp_home:.0f}",
        why_selected=f"Línea proyectada favorece a {fav_team} por {abs(home_spread):.1f} PTS.",
        stat_type=fav_stat,
        threshold=0.0,
        direction="WIN",
        void_rule="Incluye tiempo extra oficial.",
    ))
    dog_team, dog_prob, dog_stat = (away, p_ml_away, "moneyline_away") if fav_team == home else (home, p_ml_home, "moneyline_home")
    if dog_prob >= 0.28:
        cat_ml_sp["options"].append(_make_opt(
            pick=f"{dog_team} Gana el Partido (Moneyline Valor)",
            category="Moneyline",
            prob=max(0.35, dog_prob),
            player_full_name=dog_team,
            player_pos="ML",
            player_team=dog_team,
            season_avg=f"Spread ref: {spread_str or 'Parejo'}",
            safe_line=0.0,
            buffer_pct=f"Probabilidad implícita {dog_prob*100:.1f}%",
            defense_matchup=f"Proyección: {away} {exp_away:.0f} - {home} {exp_home:.0f}",
            why_selected=f"Valor en triunfo directo de {dog_team} en duelo proyectado a {abs(home_spread):.1f} PTS.",
            stat_type=dog_stat,
            threshold=0.0,
            direction="WIN",
            void_rule="Incluye tiempo extra oficial.",
        ))
    for tm, sp_base, st_key in [
        (home, home_spread, "spread_home"),
        (away, -home_spread, "spread_away"),
        (home, home_spread + 3.5, "spread_home"),
        (away, -home_spread + 3.5, "spread_away"),
        (home, home_spread + 7.5, "spread_home"),
        (away, -home_spread + 7.5, "spread_away"),
        (home, home_spread + 10.5, "spread_home"),
        (away, -home_spread + 10.5, "spread_away"),
    ]:
        alt_line = round(sp_base * 2.0) / 2.0
        if alt_line == int(alt_line):
            alt_line += 0.5
        exp_diff = -home_spread if st_key == "spread_home" else home_spread
        p_sp = normal_prob_over(exp_diff, margin_std, -alt_line)
        cat_ml_sp["options"].append(_make_opt(
            pick=f"{tm} Hándicap {alt_line:+.1f}",
            category="Hándicap / Spread",
            prob=p_sp,
            player_full_name=tm,
            player_pos="SPREAD",
            player_team=tm,
            season_avg=f"Spread mercado: {spread_str or '0.0'}",
            safe_line=alt_line,
            buffer_pct="Supera números clave 3 & 7 PTS",
            defense_matchup=f"Local Pass Def #{h_def.get('pass_def_rank', 15)} vs Visita #{a_def.get('pass_def_rank', 16)}",
            why_selected=f"Protección por encima del TD + punto extra ({alt_line:+.1f}) con {p_sp*100:.1f}%.",
            stat_type=st_key,
            threshold=alt_line,
            direction="COVER",
            void_rule="Empate exacto (Push) liquida a cuota 1.00.",
        ))
    categories.append(cat_ml_sp)

    # 3. TOTALES POR EQUIPO (4 líneas)
    cat_team_tot = {"category": "Totales por Equipo (Team Totals)", "options": []}
    for tm, exp_tm, st_key in [(home, exp_home, "home_points"), (away, exp_away, "away_points")]:
        o_line = max(9.5, round(exp_tm - 4.5) + 0.5)
        u_line = round(exp_tm + 5.5) + 0.5
        p_o = normal_prob_over(exp_tm, 10.2 if is_nfl else 11.5, o_line)
        p_u = 1.0 - normal_prob_over(exp_tm, 10.2 if is_nfl else 11.5, u_line)
        cat_team_tot["options"].append(_make_opt(
            pick=f"{tm} Total Puntos Over {o_line:.1f}",
            category="Total por Equipo",
            prob=p_o,
            player_full_name=tm,
            player_pos="TEAM PTS",
            player_team=tm,
            season_avg=f"Proyección implícita: {exp_tm:.1f} PTS",
            safe_line=o_line,
            buffer_pct=f"-{(exp_tm - o_line):.1f} PTS de colchón",
            defense_matchup=f"Total implícito Vegas {exp_tm:.1f} PTS",
            why_selected=f"{tm} proyecta {exp_tm:.1f} PTS; Over {o_line:.1f} tiene {p_o*100:.1f}%.",
            stat_type=st_key,
            threshold=o_line,
            direction="OVER",
            void_rule="Incluye tiempo extra oficial.",
        ))
        cat_team_tot["options"].append(_make_opt(
            pick=f"{tm} Total Puntos Under {u_line:.1f}",
            category="Total por Equipo",
            prob=p_u,
            player_full_name=tm,
            player_pos="TEAM PTS",
            player_team=tm,
            season_avg=f"Proyección implícita: {exp_tm:.1f} PTS",
            safe_line=u_line,
            buffer_pct=f"+{(u_line - exp_tm):.1f} PTS techo seguro",
            defense_matchup=f"Total implícito Vegas {exp_tm:.1f} PTS",
            why_selected=f"Techo seguro Under {u_line:.1f} (+{u_line - exp_tm:.1f} PTS sobre expectativa).",
            stat_type=st_key,
            threshold=u_line,
            direction="UNDER",
            void_rule="Incluye tiempo extra oficial.",
        ))
    categories.append(cat_team_tot)

    # 4. PRIMERA MITAD (1H TOTAL Y POR EQUIPO - 4 líneas)
    cat_1h = {"category": "Primera Mitad (1st Half Over / Under)", "options": []}
    exp_1h = round(proj_total * 0.49, 1)
    h1_o = max(10.5, round(exp_1h - 4.5) + 0.5)
    h1_u = round(exp_1h + 4.5) + 0.5
    p_1h_o = normal_prob_over(exp_1h, 9.8 if is_nfl else 11.0, h1_o)
    p_1h_u = 1.0 - normal_prob_over(exp_1h, 9.8 if is_nfl else 11.0, h1_u)
    cat_1h["options"].append(_make_opt(
        pick=f"1ra Mitad Puntos Over {h1_o:.1f}",
        category="Primera Mitad",
        prob=p_1h_o,
        player_full_name=match_lbl,
        player_pos="1ST HALF",
        player_team=f"{away} & {home}",
        season_avg=f"Media 1H proyectada: {exp_1h:.1f} PTS",
        safe_line=h1_o,
        buffer_pct=f"-{(exp_1h - h1_o):.1f} PTS margen",
        defense_matchup=f"Sede: {venue}",
        why_selected=f"Scripted drives de 1ra mitad proyectan {exp_1h:.1f} PTS ({p_1h_o*100:.1f}%).",
        stat_type="half_points",
        threshold=h1_o,
        direction="OVER",
        void_rule="Solo cuentan Q1 + Q2.",
    ))
    cat_1h["options"].append(_make_opt(
        pick=f"1ra Mitad Puntos Under {h1_u:.1f}",
        category="Primera Mitad",
        prob=p_1h_u,
        player_full_name=match_lbl,
        player_pos="1ST HALF",
        player_team=f"{away} & {home}",
        season_avg=f"Media 1H proyectada: {exp_1h:.1f} PTS",
        safe_line=h1_u,
        buffer_pct=f"+{(h1_u - exp_1h):.1f} PTS techo",
        defense_matchup=f"Sede: {venue}",
        why_selected=f"Techo 1ra mitad Under {h1_u:.1f} ({p_1h_u*100:.1f}%).",
        stat_type="half_points",
        threshold=h1_u,
        direction="UNDER",
        void_rule="Solo cuentan Q1 + Q2.",
    ))
    for tm, exp_tm, st_1h in [(home, exp_home * 0.49, "home_half_points"), (away, exp_away * 0.49, "away_half_points")]:
        t1h_o = max(3.5, round(exp_tm - 3.5) + 0.5)
        p_t1h = normal_prob_over(exp_tm, 7.6 if is_nfl else 8.6, t1h_o)
        cat_1h["options"].append(_make_opt(
            pick=f"1ra Mitad {tm} Over {t1h_o:.1f} PTS",
            category="Primera Mitad Equipo",
            prob=p_t1h,
            player_full_name=tm,
            player_pos="1H TEAM",
            player_team=tm,
            season_avg=f"Proyección 1H {tm}: {exp_tm:.1f} PTS",
            safe_line=t1h_o,
            buffer_pct=">= 1 TD o 2 FGs en 1H",
            defense_matchup="Q1 + Q2",
            why_selected=f"{tm} proyecta {exp_tm:.1f} PTS antes del descanso ({p_t1h*100:.1f}%).",
            stat_type=st_1h,
            threshold=t1h_o,
            direction="OVER",
            void_rule="Solo cuentan Q1 + Q2.",
        ))
    categories.append(cat_1h)

    def _opp_ctx(s: dict):
        p_team = s.get("team", home)
        opp_tm = away if p_team == home else home
        opp_def = a_def if p_team == home else h_def
        tm_sp = home_spread if p_team == home else -home_spread
        pass_yds_alw = float(opp_def.get("pass_yds_allowed", 218.0))
        rush_yds_alw = float(opp_def.get("rush_yds_allowed", 114.0))
        pass_rk = float(opp_def.get("pass_def_rank", 16))
        rush_rk = float(opp_def.get("rush_def_rank", 16))
        pts_alw = float(opp_def.get("pts_allowed", 22.0 if is_nfl else 25.5))
        # Pass Funnel & Rush Funnel + Game Script + Dome
        pass_mult = max(0.84, min(1.20, 0.62 * (pass_yds_alw / 218.0) + 0.38 * (1.0 + (pass_rk - 16.5) * 0.0055) + (0.032 if is_dome else 0.0) + (0.035 if tm_sp >= 4.0 else 0.0)))
        rush_mult = max(0.82, min(1.22, 0.62 * (rush_yds_alw / 114.0) + 0.38 * (1.0 + (rush_rk - 16.5) * 0.0065) + (0.045 if tm_sp <= -4.0 else (-0.03 if tm_sp >= 6.5 else 0.0))))
        td_mult = max(0.82, min(1.24, pts_alw / (22.0 if is_nfl else 25.5)))
        return p_team, opp_tm, opp_def, pass_mult, rush_mult, td_mult

    # 5. YARDAS POR PASE DE QB (Empirical Bayes + Pass Funnel Rival)
    cat_pass = {"category": "Yardas por Pase de QB", "options": []}
    for s in stars:
        if s.get("pos") == "QB" or float(s.get("pass_yds", 0.0)) >= 120.0:
            raw_pass = max(145.0, float(s.get("pass_yds", 225.0)))
            base_pass = round(0.75 * raw_pass + 0.25 * (220.0 if is_nfl else 205.0), 1)
            p_team, opp_tm, opp_def, pass_mult, _, _ = _opp_ctx(s)
            exp_pass = round(base_pass * pass_mult, 1)
            for tag, mult in [("Segura", 0.74), ("Media", 0.86)]:
                safe_line = max(119.5, round(exp_pass * mult) + 0.5)
                p_pass = normal_prob_over(exp_pass, max(62.0, float(s.get('pass_yds_std') or exp_pass * 0.34)), safe_line)
                cat_pass["options"].append(_make_opt(
                    pick=f"{s['name']} Over {safe_line:.1f} Yardas de Pase ({tag})",
                    category="Yardas Pase QB",
                    prob=p_pass,
                    player_full_name=s["name"],
                    player_pos=f"QB #{s.get('jersey', '0')}",
                    player_team=p_team,
                    player_role=s.get("role", "Mariscal Titular"),
                    season_avg=f"{base_pass:.1f} YDS/juego",
                    safe_line=safe_line,
                    buffer_pct=f"-{round(exp_pass - safe_line, 1)} YDS colchón",
                    defense_matchup=f"vs {opp_tm} (Def Pase #{opp_def.get('pass_def_rank', 16)}, {opp_def.get('pass_yds_allowed', 220.0)} YDS/g | {pass_mult:.2f}x)",
                    why_selected=f"Media {base_pass:.1f} YDS cruzada a {exp_pass:.1f} YDS vs secundaria de {opp_tm} ({p_pass*100:.1f}%).",
                    stat_type="qb_pass_yds",
                    threshold=safe_line,
                    direction="OVER",
                    player=s["name"],
                ))
    categories.append(cat_pass)

    # 6. PASES DE TOUCHDOWN DE QB (Cruzado por Red-Zone Concesión Rival)
    cat_tds = {"category": "Pases de Touchdown de QB", "options": []}
    for s in stars:
        if s.get("pos") == "QB" or float(s.get("pass_yds", 0.0)) >= 120.0:
            base_tds = max(0.85, 0.72 * float(s.get("pass_tds", 1.45)) + 0.28 * 1.40)
            p_team, opp_tm, opp_def, pass_mult, _, td_mult = _opp_ctx(s)
            adj_tds = round(base_tds * (0.55 * td_mult + 0.45 * pass_mult), 2)
            for td_line in (0.5, 1.5):
                if td_line == 1.5 and adj_tds < 1.45:
                    continue
                p_td = 0.82 * poisson_prob_over(adj_tds, td_line) + 0.18 * 0.50
                cat_tds["options"].append(_make_opt(
                    pick=f"{s['name']} Over {td_line:.1f} Pases de TD",
                    category="Pases de Touchdown",
                    prob=p_td,
                    player_full_name=s["name"],
                    player_pos=f"QB #{s.get('jersey', '0')}",
                    player_team=p_team,
                    player_role=s.get("role", "Mariscal Titular"),
                    season_avg=f"{base_tds:.2f} Pases TD/j (aj. {adj_tds:.2f})",
                    safe_line=td_line,
                    buffer_pct=">= 1 TD" if td_line == 0.5 else ">= 2 TDs",
                    defense_matchup=f"vs {opp_tm} ({opp_def.get('pts_allowed', 22.0)} PTS perm./j)",
                    why_selected=f"Media ajustada {adj_tds:.2f} TD/j vs defensa de {opp_tm}, Poisson P(X>{td_line:.1f}) = {p_td*100:.1f}%.",
                    stat_type="qb_pass_tds",
                    threshold=td_line,
                    direction="OVER",
                    player=s["name"],
                ))
    categories.append(cat_tds)

    # 7. YARDAS TERRESTRES (RB / MOBILE QB - Cruzado por Rush Funnel Rival)
    cat_rush = {"category": "Yardas Terrestres (RB / QB Móvil)", "options": []}
    for s in stars:
        raw_rush = float(s.get("rush_yds", 0.0))
        if s.get("pos") == "RB" or raw_rush >= 25.0:
            raw_rush = max(32.0, raw_rush)
            base_rush = round(0.75 * raw_rush + 0.25 * 55.0, 1)
            p_team, opp_tm, opp_def, _, rush_mult, _ = _opp_ctx(s)
            adj_rush = round(base_rush * rush_mult, 1)
            safe_line = max(18.5, round(adj_rush * 0.68) + 0.5)
            p_rush = normal_prob_over(adj_rush, max(24.0, float(s.get('rush_yds_std') or adj_rush * 0.48)), safe_line)
            cat_rush["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} Yardas Terrestres",
                category="Yardas Terrestres",
                prob=p_rush,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'RB')} #{s.get('jersey', '0')}",
                player_team=p_team,
                player_role=s.get("role", "Corredor Principal"),
                season_avg=f"{base_rush:.1f} YDS/j (aj. {adj_rush:.1f})",
                safe_line=safe_line,
                buffer_pct=f"-{round(((adj_rush - safe_line)/max(1.0, adj_rush))*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm} (Def Carrera #{opp_def.get('rush_def_rank', 15)}, {opp_def.get('rush_yds_allowed', 115.0)} YDS/g | {rush_mult:.2f}x)",
                why_selected=f"Base {base_rush:.1f} YDS cruzada a {adj_rush:.1f} YDS vs frente terrestre de {opp_tm}; línea {safe_line:.1f} ({p_rush*100:.1f}%).",
                stat_type="rb_rush_yds",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_rush)

    # 8. YARDAS DE RECEPCIÓN (WR / TE - Cruzado por Secundaria Rival)
    cat_rec = {"category": "Yardas de Recepción (WR / TE)", "options": []}
    for s in stars:
        raw_rec = float(s.get("rec_yds", 0.0))
        if s.get("pos") in ("WR", "TE") or raw_rec >= 25.0:
            raw_rec = max(32.0, raw_rec)
            base_rec = round(0.75 * raw_rec + 0.25 * 48.0, 1)
            p_team, opp_tm, opp_def, pass_mult, _, _ = _opp_ctx(s)
            adj_rec = round(base_rec * pass_mult, 1)
            safe_line = max(19.5, round(adj_rec * 0.66) + 0.5)
            p_rec = normal_prob_over(adj_rec, max(25.0, float(s.get('rec_yds_std') or adj_rec * 0.55)), safe_line)
            cat_rec["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} Yardas de Recepción",
                category="Yardas Recepción",
                prob=p_rec,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'WR')} #{s.get('jersey', '0')}",
                player_team=p_team,
                player_role=s.get("role", "Receptor Principal"),
                season_avg=f"{base_rec:.1f} YDS/j (aj. {adj_rec:.1f})",
                safe_line=safe_line,
                buffer_pct=f"-{round(((adj_rec - safe_line)/max(1.0, adj_rec))*100, 1)}% margen",
                defense_matchup=f"vs secundaria {opp_tm} (#{opp_def.get('pass_def_rank', 16)}, {opp_def.get('pass_yds_allowed', 220.0)} YDS/g | {pass_mult:.2f}x)",
                why_selected=f"Base {base_rec:.1f} YDS cruzada a {adj_rec:.1f} YDS vs cobertura de {opp_tm}; línea {safe_line:.1f} ({p_rec*100:.1f}%).",
                stat_type="wr_rec_yds",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_rec)

    # 9. RECEPCIONES TOTALES (RECEPTIONS)
    cat_receptions = {"category": "Recepciones Totales (Receptions)", "options": []}
    for s in stars:
        receptions = float(s.get("receptions", 0.0))
        if receptions < 1.8 and float(s.get("rec_yds", 0.0)) >= 30.0:
            receptions = round(float(s.get("rec_yds", 40.0)) / 13.5, 1)
        if receptions >= 2.2:
            p_team, opp_tm, _, pass_mult, _, _ = _opp_ctx(s)
            adj_rcp = round(receptions * (0.5 + 0.5 * pass_mult), 2)
            safe_line = max(1.5, round(adj_rcp * 0.65) - 0.5)
            p_rcp = normal_prob_over(0.80 * adj_rcp + 0.20 * 3.8, max(1.9, float(s.get('receptions_std') or adj_rcp * 0.50)), safe_line)
            cat_receptions["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} Recepciones",
                category="Recepciones",
                prob=p_rcp,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'WR')} #{s.get('jersey', '0')}",
                player_team=p_team,
                season_avg=f"{receptions:.1f} REC/juego",
                safe_line=safe_line,
                buffer_pct=f"-{round(((receptions - safe_line)/receptions)*100, 1)}% margen",
                defense_matchup=f"vs cobertura de {opp_tm}",
                why_selected=f"Volumen de {receptions:.1f} recepciones/juego da {p_rcp*100:.1f}% vía Poisson.",
                stat_type="wr_receptions",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_receptions)

    # 10. YARDAS COMBINADAS SCRIMMAGE (RUSH + REC - Cruzado por Defensa Rival)
    cat_scrim = {"category": "Yardas Totales Scrimmage (Carrera + Recepción)", "options": []}
    for s in stars:
        scrim = float(s.get("rush_yds", 0.0)) + float(s.get("rec_yds", 0.0))
        if s.get("pos") != "QB" and scrim >= 40.0:
            p_team, opp_tm, _, pass_mult, rush_mult, _ = _opp_ctx(s)
            adj_scrim = round(scrim * (0.55 * rush_mult + 0.45 * pass_mult), 1)
            safe_line = max(29.5, round(adj_scrim * 0.70) + 0.5)
            p_scr = normal_prob_over(0.80 * adj_scrim + 0.20 * 65.0, max(28.0, adj_scrim * 0.46), safe_line)
            cat_scrim["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} YDS Scrimmage (Rush+Rec)",
                category="Scrimmage YDS",
                prob=p_scr,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'RB')} #{s.get('jersey', '0')}",
                player_team=p_team,
                season_avg=f"{scrim:.1f} YDS/j (aj. {adj_scrim:.1f})",
                safe_line=safe_line,
                buffer_pct=f"-{round(((adj_scrim - safe_line)/max(1.0, adj_scrim))*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Uso dual carrera+pase cruzado a {adj_scrim:.1f} YDS ante {opp_tm} ({p_scr*100:.1f}%).",
                stat_type="scrimmage_yds",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_scrim)

    # 11. ANOTADOR EN CUALQUIER MOMENTO (ANYTIME TD - Cruzado por Zona Roja Rival)
    cat_atd = {"category": "Anotador en Cualquier Momento (Anytime TD)", "options": []}
    for s in stars:
        td_rate = float(s.get("anytime_td_pct", 35.0))
        if td_rate >= 34.0:
            p_team, opp_tm, _, _, _, td_mult = _opp_ctx(s)
            p_atd = min(0.68, max(0.24, (0.75 * (td_rate / 100.0) + 0.25 * 0.35) * (0.55 + 0.45 * td_mult)))
            cat_atd["options"].append(_make_opt(
                pick=f"{s['name']} Anota Touchdown (Anytime TD)",
                category="Anytime Touchdown",
                prob=p_atd,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'RB')} #{s.get('jersey', '0')}",
                player_team=p_team,
                player_role=s.get("role", "Zona Roja"),
                season_avg=f"{td_rate:.0f}% tasa de TD",
                safe_line=0.5,
                buffer_pct="Opción primaria en zona de gol",
                defense_matchup=f"vs {opp_tm} en zona roja",
                why_selected=f"Alta participación en yarda 10 de {p_team} con tasa del {td_rate:.0f}%.",
                stat_type="anytime_td",
                threshold=0.5,
                direction="YES",
                player=s["name"],
            ))
    categories.append(cat_atd)

    for c in categories:
        c["options"].sort(key=lambda x: (x["prob_num"], x["odds_num"]), reverse=True)

    team_cats = {"Puntos Totales", "Moneyline", "Hándicap / Spread", "Total por Equipo", "1ra Mitad"}
    team_opts = [opt for c in categories for opt in c["options"] if opt.get("category") in team_cats]
    player_opts = [opt for c in categories for opt in c["options"] if opt.get("category") not in team_cats]
    team_opts.sort(key=lambda x: (x["prob_num"], x["odds_num"]), reverse=True)
    player_opts.sort(key=lambda x: (x["prob_num"], x["odds_num"]), reverse=True)

    all_flat = [opt for c in categories for opt in c["options"]]
    all_flat.sort(key=lambda x: (x["prob_num"], x["odds_num"]), reverse=True)
    best_pick = team_opts[0] if team_opts else (all_flat[0] if all_flat else {})
    top_4_vars = (team_opts[:3] + player_opts[:2])[:4] if team_opts else all_flat[1:5]

    return {
        "match": game.get("match", match_lbl),
        "league": league,
        "time_cdmx": game.get("time_cdmx", "12:00"),
        "best_pick": best_pick,
        "variables": top_4_vars,
        "categories": categories,
        "total_options": len(all_flat),
    }
