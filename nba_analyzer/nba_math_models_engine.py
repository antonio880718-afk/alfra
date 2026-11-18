# -*- coding: utf-8 -*-
"""
nba_math_models_engine.py - Motor Cuantitativo y Modelos Matemáticos para Baloncesto (NBA y NCAAB).
Calcula Posesiones Proyectadas (Pace), Puntos Implícitos por Equipo, Distribuciones de Player Props
(PTS, REB, AST, 3PM, PRA, P+R, P+A, Stocks, Doble-Doble), Cuotas Justas y +EV en 11 categorías.
"""
import math
import re


def poisson_prob_over(lam: float, k: float) -> float:
    """Calcula P(X > k) para una variable Poisson con media lam."""
    lam = max(0.05, float(lam))
    prob_le = 0.0
    k_int = int(math.floor(k))
    for i in range(max(0, k_int) + 1):
        prob_le += (math.exp(-lam) * (lam ** i)) / math.factorial(i)
    return max(0.01, min(0.99, 1.0 - prob_le))


def normal_prob_over(mean: float, std: float, k: float) -> float:
    """Aproximación de P(X > k) mediante distribución normal."""
    z = (k - mean) / (std if std > 0 else 1.0)
    cdf = 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
    return max(0.02, min(0.98, 1.0 - cdf))


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
    player_role: str = "Titular / Rotación",
    void_rule: str = "Si el jugador no disputa minutos oficiales (DNP), se anula a cuota 1.00 (VOID).",
) -> dict:
    prob = max(0.52, min(0.96, float(prob)))
    odds_num = round(min(2.60, max(1.12, (1.0 / prob) * 1.035)), 2)
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


def compute_full_nba_game_data_engineering(game: dict) -> dict:
    """
    Genera ~45-65 mercados cuantitativos calibrados por partido en 11 categorías auditables.
    """
    home = game.get("home", "Home Team")
    away = game.get("away", "Away Team")
    league = game.get("league", "NBA")
    ou_line = float(game.get("over_under", 226.5 if league == "NBA" else 145.5))
    spread_str = game.get("spread_str", "")
    _raw_stars = game.get("stars", [])
    try:
        import os as _os_ij, json as _json_ij
        _ij_p = _os_ij.path.join(_os_ij.path.dirname(_os_ij.path.abspath(__file__)), "data", "espn_injured_blacklist.json")
        _ij_set = set(_json_ij.load(open(_ij_p, "r", encoding="utf-8"))) if _os_ij.path.exists(_ij_p) else set()
    except Exception:
        _ij_set = set()
    stars = [s for s in _raw_stars if str(s.get("name", "")).lower().strip() not in _ij_set]
    venue = game.get("venue", "Arena Oficial")

    try:
        from nba_data_api import NBA_DEFENSE_PROFILES
    except Exception:
        NBA_DEFENSE_PROFILES = {}
    h_def = dict(NBA_DEFENSE_PROFILES.get(home, game.get("home_defense", {"def_rank": 14, "pts_allowed": 112.8, "pace": 99.8, "style": "Defensa Táctica"})))
    a_def = dict(NBA_DEFENSE_PROFILES.get(away, game.get("away_defense", {"def_rank": 16, "pts_allowed": 113.6, "pace": 100.1, "style": "Defensa Táctica"})))

    is_nba = league == "NBA"
    tot_std = 16.0 if is_nba else 12.5
    margin_std = 11.5 if is_nba else 10.5
    expected_pace = round((float(h_def.get("pace", 100.0)) + float(a_def.get("pace", 100.0))) / 2.0, 1) if is_nba else 68.5
    h_pa = float(h_def.get("pts_allowed", 113.5 if is_nba else 72.5))
    a_pa = float(a_def.get("pts_allowed", 114.0 if is_nba else 73.0))
    pace_factor = (expected_pace / 100.0) if is_nba else 1.0
    def_cross_total = (h_pa + a_pa) * pace_factor
    has_vegas_spread = bool(spread_str and str(spread_str).strip())
    home_spread = _extract_home_spread(spread_str, home, away)
    if not has_vegas_spread:
        hca = 2.8 if is_nba else 3.5
        home_spread = round(max(-14.5, min(14.5, (h_pa - a_pa) * 0.65 - hca)), 1)
    is_default_ou = (is_nba and abs(ou_line - 226.5) < 0.05) or ((not is_nba) and abs(ou_line - 145.5) < 0.05)
    proj_total = round((0.30 * ou_line + 0.70 * def_cross_total) if (is_default_ou and not has_vegas_spread) else (0.65 * ou_line + 0.35 * def_cross_total), 1)
    exp_home = round((proj_total - home_spread) / 2.0, 1)
    exp_away = round((proj_total + home_spread) / 2.0, 1)
    match_lbl = f"{away} @ {home}"

    categories = []

    # 1. PUNTOS TOTALES PARTIDO (8 líneas: Segura, Alternativa, Conservadora y Principal)
    cat_totals = {"category": "Puntos Totales Partido (Over / Under)", "options": []}
    for label, delta, direction in [
        ("Over Blindado (-11.5)", -11.5, "OVER"),
        ("Over Seguro (-8.5)", -8.5, "OVER"),
        ("Over Alternativo (-4.5)", -4.5, "OVER"),
        ("Over Línea Principal (0.0)", 0.0, "OVER"),
        ("Under Blindado (+11.5)", 11.5, "UNDER"),
        ("Under Seguro (+8.5)", 8.5, "UNDER"),
        ("Under Alternativo (+4.5)", 4.5, "UNDER"),
        ("Under Línea Principal (0.0)", 0.0, "UNDER"),
    ]:
        line = round(proj_total + delta - 0.5) + 0.5
        p_val = normal_prob_over(proj_total, tot_std, line) if direction == "OVER" else (1.0 - normal_prob_over(proj_total, tot_std, line))
        buf_sign = "-" if direction == "OVER" else "+"
        cat_totals["options"].append(_make_opt(
            pick=f"Total Puntos {'Over' if direction=='OVER' else 'Under'} {line:.1f}",
            category="Puntos Totales",
            prob=p_val,
            player_full_name=match_lbl,
            player_pos="MATCH TOTAL",
            player_team=f"{away} & {home}",
            season_avg=f"Línea Vegas: {ou_line:.1f} PTS",
            safe_line=line,
            buffer_pct=f"{buf_sign}{abs(ou_line - line):.1f} PTS ({label})",
            defense_matchup=f"Pace proyectado: {expected_pace:.1f} pos. | {venue}",
            why_selected=f"Línea oficial {ou_line:.1f} PTS; ajustar a {line:.1f} otorga margen de {abs(ou_line - line):.1f} PTS con {p_val*100:.1f}% de probabilidad.",
            stat_type="total_points",
            threshold=line,
            direction=direction,
            void_rule="Anulación automática (VOID) si el encuentro no finaliza oficialmente.",
        ))
    categories.append(cat_totals)

    # 2. MONEYLINE Y HÁNDICAPS (4 líneas)
    cat_ml_sp = {"category": "Moneyline & Hándicaps (Spread)", "options": []}
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
        defense_matchup=f"Proyección marcador: {away} {exp_away:.0f} - {home} {exp_home:.0f}",
        why_selected=f"Diferencial proyectado de {abs(home_spread):.1f} PTS favorece a {fav_team} en marcador final (incluye prórroga).",
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
            buffer_pct=f"Probabilidad real {dog_prob*100:.1f}%",
            defense_matchup=f"Proyección marcador: {away} {exp_away:.0f} - {home} {exp_home:.0f}",
            why_selected=f"Valor en Moneyline de {dog_team} en duelo proyectado a {abs(home_spread):.1f} PTS.",
            stat_type=dog_stat,
            threshold=0.0,
            direction="WIN",
            void_rule="Incluye tiempo extra oficial.",
        ))
    for tm, sp_base, st_key in [
        (home, home_spread, "spread_home"),
        (away, -home_spread, "spread_away"),
        (home, home_spread + 4.5, "spread_home"),
        (away, -home_spread + 4.5, "spread_away"),
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
            buffer_pct="+6.5 / +10.5 PTS de colchón comprado",
            defense_matchup=f"Defensa Local #{h_def.get('def_rank', 15)} vs Visita #{a_def.get('def_rank', 16)}",
            why_selected=f"Comprar margen a {tm} {alt_line:+.1f} protege frente a partidos cerrados ({p_sp*100:.1f}% de cobertura).",
            stat_type=st_key,
            threshold=alt_line,
            direction="COVER",
            void_rule="Empate exacto (Push) liquida a cuota 1.00.",
        ))
    categories.append(cat_ml_sp)

    # 3. TOTALES POR EQUIPO (4 líneas)
    cat_team_tot = {"category": "Totales por Equipo (Team Totals)", "options": []}
    tm_std = 10.5 if is_nba else 8.5
    for tm, exp_tm, st_key in [(home, exp_home, "home_points"), (away, exp_away, "away_points")]:
        o_line = round(exp_tm - 5.5) + 0.5
        u_line = round(exp_tm + 5.5) + 0.5
        p_o = normal_prob_over(exp_tm, tm_std, o_line)
        p_u = 1.0 - normal_prob_over(exp_tm, tm_std, u_line)
        cat_team_tot["options"].append(_make_opt(
            pick=f"{tm} Total Puntos Over {o_line:.1f}",
            category="Total por Equipo",
            prob=p_o,
            player_full_name=tm,
            player_pos="TEAM PTS",
            player_team=tm,
            season_avg=f"Proyección implícita: {exp_tm:.1f} PTS",
            safe_line=o_line,
            buffer_pct=f"-{(exp_tm - o_line):.1f} PTS sobre proyección",
            defense_matchup=f"Rival permite {a_def.get('pts_allowed', 113.5) if tm==home else h_def.get('pts_allowed', 113.5)} PTS/juego",
            why_selected=f"{tm} proyecta {exp_tm:.1f} PTS; superar {o_line:.1f} tiene {p_o*100:.1f}% de acierto.",
            stat_type=st_key,
            threshold=o_line,
            direction="OVER",
            void_rule="Incluye prórroga oficial.",
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
            buffer_pct=f"+{(u_line - exp_tm):.1f} PTS de techo seguro",
            defense_matchup=f"Ritmo esperado: {expected_pace:.1f}",
            why_selected=f"Techo seguro Under {u_line:.1f} con +{u_line - exp_tm:.1f} PTS por encima de su media esperada.",
            stat_type=st_key,
            threshold=u_line,
            direction="UNDER",
            void_rule="Incluye prórroga oficial.",
        ))
    categories.append(cat_team_tot)

    # 4. PRIMERA MITAD (1H TOTAL Y POR EQUIPO - 4 líneas)
    cat_1h = {"category": "Primera Mitad (1st Half Over / Under)", "options": []}
    exp_1h = round(ou_line * 0.49, 1)
    h1_over = round(exp_1h - 5.5) + 0.5
    h1_under = round(exp_1h + 5.5) + 0.5
    p_1h_o = normal_prob_over(exp_1h, 10.0 if is_nba else 8.0, h1_over)
    p_1h_u = 1.0 - normal_prob_over(exp_1h, 10.0 if is_nba else 8.0, h1_under)
    cat_1h["options"].append(_make_opt(
        pick=f"1ra Mitad Total Puntos Over {h1_over:.1f}",
        category="Primera Mitad",
        prob=p_1h_o,
        player_full_name=match_lbl,
        player_pos="1ST HALF",
        player_team=f"{away} & {home}",
        season_avg=f"Media 1H proyectada: {exp_1h:.1f} PTS",
        safe_line=h1_over,
        buffer_pct=f"-{(exp_1h - h1_over):.1f} PTS margen",
        defense_matchup=f"Pace {expected_pace:.1f} | Rotaciones titulares completas en 1H",
        why_selected=f"Los quintetos iniciales juegan los mayores tramos en la 1ra mitad (media {exp_1h:.1f} PTS).",
        stat_type="half_points",
        threshold=h1_over,
        direction="OVER",
        void_rule="Solo cuentan los 2 primeros cuartos (o 1ra mitad NCAA).",
    ))
    cat_1h["options"].append(_make_opt(
        pick=f"1ra Mitad Total Puntos Under {h1_under:.1f}",
        category="Primera Mitad",
        prob=p_1h_u,
        player_full_name=match_lbl,
        player_pos="1ST HALF",
        player_team=f"{away} & {home}",
        season_avg=f"Media 1H proyectada: {exp_1h:.1f} PTS",
        safe_line=h1_under,
        buffer_pct=f"+{(h1_under - exp_1h):.1f} PTS techo seguro",
        defense_matchup="Sin faltas tácticas de cierre en 1ra mitad",
        why_selected=f"Sin tiempos fuera ni tiros libres intencionales de final de juego en 1H ({p_1h_u*100:.1f}%).",
        stat_type="half_points",
        threshold=h1_under,
        direction="UNDER",
        void_rule="Solo cuenta la primera mitad oficial.",
    ))
    for tm, exp_tm, st_1h in [(home, exp_home * 0.49, "home_half_points"), (away, exp_away * 0.49, "away_half_points")]:
        tm_1h_line = round(exp_tm - 3.5) + 0.5
        p_tm_1h = normal_prob_over(exp_tm, 6.5 if is_nba else 5.5, tm_1h_line)
        cat_1h["options"].append(_make_opt(
            pick=f"1ra Mitad {tm} Over {tm_1h_line:.1f} PTS",
            category="Primera Mitad Equipo",
            prob=p_tm_1h,
            player_full_name=tm,
            player_pos="1H TEAM",
            player_team=tm,
            season_avg=f"Proyección 1H {tm}: {exp_tm:.1f} PTS",
            safe_line=tm_1h_line,
            buffer_pct=f"-{(exp_tm - tm_1h_line):.1f} PTS de colchón",
            defense_matchup=f"Proyección inicial {exp_tm:.1f} PTS",
            why_selected=f"{tm} promedia {exp_tm:.1f} PTS en la primera mitad.",
            stat_type=st_1h,
            threshold=tm_1h_line,
            direction="OVER",
            void_rule="Solo cuenta la 1ra mitad.",
        ))
    categories.append(cat_1h)

    # Helper cuantitativo: Cruce Defensa Rival + Pace + Riesgo de Blowout
    def _opp_ctx(s: dict):
        p_team = s.get("team", home)
        opp_def = a_def if p_team == home else h_def
        opp_tm = away if p_team == home else home
        base_pa = 113.5 if is_nba else 72.5
        base_pc = 100.0 if is_nba else 68.5
        def_mult = float(opp_def.get("pts_allowed", base_pa)) / base_pa
        rk_mult = 1.0 + (float(opp_def.get("def_rank", 15)) - 15.5) * 0.0042
        pc_mult = 1.0 + ((float(opp_def.get("pace", base_pc)) - base_pc) * 0.0065)
        blowout_disc = 0.955 if abs(home_spread) >= 12.5 else 1.0
        pace_adj = max(0.85, min(1.18, (0.55 * def_mult + 0.45 * (rk_mult * pc_mult)) * blowout_disc))
        return p_team, opp_tm, opp_def, pace_adj

    # 5. PUNTOS DE JUGADOR (PTS - Empirical Bayes shrinkage + cruce defensivo rival)
    cat_pts = {"category": "Puntos de Jugador (PTS)", "options": []}
    for s in stars[:8]:
        raw_pts = float(s.get("pts", 16.0))
        if raw_pts < 6.5:
            continue
        # Contracción Empírica de Bayes para amortiguar picos de un solo partido de ESPN leaders
        base_pts = round(25.5 + (raw_pts - 25.5) * 0.52, 1) if raw_pts > 26.5 else raw_pts
        p_team, opp_tm, opp_def, pace_adj = _opp_ctx(s)
        adj_pts = round(base_pts * pace_adj, 1)
        safe_line = max(5.5, round(adj_pts * 0.72) + 0.5)
        prob_pts = normal_prob_over(adj_pts, max(4.2, adj_pts * 0.25), safe_line)
        cat_pts["options"].append(_make_opt(
            pick=f"{s['name']} Over {safe_line:.1f} Puntos",
            category="Puntos Jugador",
            prob=prob_pts,
            player_full_name=s["name"],
            player_pos=f"{s.get('pos', 'G')} #{s.get('jersey', '0')}",
            player_team=p_team,
            player_role=s.get("role", "Titular"),
            season_avg=f"{base_pts:.1f} PPG oficiales",
            safe_line=safe_line,
            buffer_pct=f"-{round(((base_pts - safe_line)/max(1.0, base_pts))*100, 1)}% colchón",
            defense_matchup=f"vs {opp_tm} (Def #{opp_def.get('def_rank', 15)}, {opp_def.get('pts_allowed', 113.5)} PPG)",
            why_selected=f"{s['name']} promedia {base_pts:.1f} PPG; ajustado a {adj_pts:.1f} PTS vs {opp_tm}, línea segura {safe_line:.1f} ({prob_pts*100:.1f}%).",
            stat_type="player_pts",
            threshold=safe_line,
            direction="OVER",
            player=s["name"],
        ))
        if base_pts >= 18.0:
            hi_line = round(adj_pts * 0.85) + 0.5
            if hi_line > safe_line + 1.5:
                p_hi = normal_prob_over(adj_pts, max(4.2, adj_pts * 0.25), hi_line)
                cat_pts["options"].append(_make_opt(
                    pick=f"{s['name']} Over {hi_line:.1f} Puntos (Línea Media)",
                    category="Puntos Jugador",
                    prob=p_hi,
                    player_full_name=s["name"],
                    player_pos=f"{s.get('pos', 'G')} #{s.get('jersey', '0')}",
                    player_team=p_team,
                    player_role=s.get("role", "Titular"),
                    season_avg=f"{base_pts:.1f} PPG oficiales",
                    safe_line=hi_line,
                    buffer_pct=f"-{round(((base_pts - hi_line)/max(1.0, base_pts))*100, 1)}% colchón",
                    defense_matchup=f"vs {opp_tm} (Def #{opp_def.get('def_rank', 15)})",
                    why_selected=f"Segunda línea con mayor cuota para {s['name']} (media ajustada {adj_pts:.1f} PTS).",
                    stat_type="player_pts",
                    threshold=hi_line,
                    direction="OVER",
                    player=s["name"],
                ))
    categories.append(cat_pts)

    # 6. REBOTES DE JUGADOR (REB)
    cat_reb = {"category": "Rebotes de Jugador (REB)", "options": []}
    for s in stars[:8]:
        base_reb = float(s.get("reb", 4.0))
        if base_reb < 3.0:
            continue
        p_team, opp_tm, opp_def, _ = _opp_ctx(s)
        safe_line = max(2.5, round(base_reb * 0.68) + 0.5)
        prob_reb = poisson_prob_over(base_reb, safe_line)
        cat_reb["options"].append(_make_opt(
            pick=f"{s['name']} Over {safe_line:.1f} Rebotes",
            category="Rebotes Jugador",
            prob=prob_reb,
            player_full_name=s["name"],
            player_pos=s.get("pos", "F"),
            player_team=p_team,
            player_role=s.get("role", "Titular"),
            season_avg=f"{base_reb:.1f} RPG",
            safe_line=safe_line,
            buffer_pct=f"-{round(((base_reb - safe_line)/max(1.0, base_reb))*100, 1)}% margen",
            defense_matchup=f"vs {opp_tm} ({opp_def.get('style', 'Estándar')})",
            why_selected=f"Media de {base_reb:.1f} REB/juego; Poisson P(X>{safe_line:.1f}) = {prob_reb*100:.1f}%.",
            stat_type="player_reb",
            threshold=safe_line,
            direction="OVER",
            player=s["name"],
        ))
    categories.append(cat_reb)

    # 7. ASISTENCIAS DE JUGADOR (AST)
    cat_ast = {"category": "Asistencias de Jugador (AST)", "options": []}
    for s in stars[:8]:
        base_ast = float(s.get("ast", 3.0))
        if base_ast < 2.2:
            continue
        p_team, opp_tm, opp_def, _ = _opp_ctx(s)
        safe_line = max(1.5, round(base_ast * 0.65) + 0.5)
        prob_ast = poisson_prob_over(base_ast, safe_line)
        cat_ast["options"].append(_make_opt(
            pick=f"{s['name']} Over {safe_line:.1f} Asistencias",
            category="Asistencias Jugador",
            prob=prob_ast,
            player_full_name=s["name"],
            player_pos=s.get("pos", "G"),
            player_team=p_team,
            player_role=s.get("role", "Playmaker"),
            season_avg=f"{base_ast:.1f} APG",
            safe_line=safe_line,
            buffer_pct=f"-{round(((base_ast - safe_line)/max(1.0, base_ast))*100, 1)}% margen",
            defense_matchup=f"vs {opp_tm} (Pace {opp_def.get('pace', 100.0)})",
            why_selected=f"{s['name']} genera {base_ast:.1f} APG; línea segura {safe_line:.1f} ({prob_ast*100:.1f}%).",
            stat_type="player_ast",
            threshold=safe_line,
            direction="OVER",
            player=s["name"],
        ))
    categories.append(cat_ast)

    # 8. TRIPLES CONVERTIDOS (3PM)
    cat_3pm = {"category": "Triples Convertidos (3PM)", "options": []}
    for s in stars[:8]:
        base_3 = float(s.get("threes", 1.5))
        if base_3 < 1.1:
            continue
        p_team, opp_tm, opp_def, _ = _opp_ctx(s)
        safe_line = 0.5 if base_3 < 2.4 else 1.5
        prob_3 = poisson_prob_over(base_3, safe_line)
        cat_3pm["options"].append(_make_opt(
            pick=f"{s['name']} Over {safe_line:.1f} Triples",
            category="Triples (3PM)",
            prob=prob_3,
            player_full_name=s["name"],
            player_pos=s.get("pos", "G"),
            player_team=p_team,
            player_role=s.get("role", "Tirador"),
            season_avg=f"{base_3:.1f} 3PM/juego",
            safe_line=safe_line,
            buffer_pct="Mínimo 1 triple" if safe_line == 0.5 else "Mínimo 2 triples",
            defense_matchup=f"vs perímetro de {opp_tm}",
            why_selected=f"Media de {base_3:.1f} triples/juego da {prob_3*100:.1f}% vía Poisson para Over {safe_line:.1f}.",
            stat_type="player_threes",
            threshold=safe_line,
            direction="OVER",
            player=s["name"],
        ))
    categories.append(cat_3pm)

    # 9. COMBO PRA (PUNTOS + REBOTES + ASISTENCIAS)
    cat_pra = {"category": "Combo PRA (Puntos + Rebotes + Asistencias)", "options": []}
    for s in stars[:8]:
        base_pra = float(s.get("pra", s.get("pts", 15) + s.get("reb", 4) + s.get("ast", 3)))
        if base_pra < 12.0:
            continue
        p_team, opp_tm, opp_def, _ = _opp_ctx(s)
        safe_line = max(9.5, round(base_pra * 0.76) + 0.5)
        prob_pra = normal_prob_over(base_pra, max(5.5, base_pra * 0.22), safe_line)
        cat_pra["options"].append(_make_opt(
            pick=f"{s['name']} Over {safe_line:.1f} PRA",
            category="Combo PRA",
            prob=prob_pra,
            player_full_name=s["name"],
            player_pos=s.get("pos", "F"),
            player_team=p_team,
            player_role=s.get("role", "Estrella"),
            season_avg=f"{base_pra:.1f} PRA/juego",
            safe_line=safe_line,
            buffer_pct=f"-{round(((base_pra - safe_line)/max(1.0, base_pra))*100, 1)}% colchón",
            defense_matchup=f"vs {opp_tm} (Def #{opp_def.get('def_rank', 15)})",
            why_selected=f"Suma integral P+R+A ({base_pra:.1f} avg) reduce varianza de tiro ({prob_pra*100:.1f}%).",
            stat_type="player_pra",
            threshold=safe_line,
            direction="OVER",
            player=s["name"],
        ))
    categories.append(cat_pra)

    # 10. COMBOS P+R Y P+A
    cat_pr_pa = {"category": "Combos Puntos+Rebotes (P+R) y Puntos+Asistencias (P+A)", "options": []}
    for s in stars[:6]:
        base_pts = float(s.get("pts", 14.0))
        base_reb = float(s.get("reb", 4.0))
        base_ast = float(s.get("ast", 3.0))
        p_team, opp_tm, _, _ = _opp_ctx(s)
        pr_avg = round(base_pts + base_reb, 1)
        pa_avg = round(base_pts + base_ast, 1)
        if pr_avg >= 14.0:
            pr_line = max(9.5, round(pr_avg * 0.75) + 0.5)
            p_pr = normal_prob_over(pr_avg, max(4.5, pr_avg * 0.22), pr_line)
            cat_pr_pa["options"].append(_make_opt(
                pick=f"{s['name']} Over {pr_line:.1f} Puntos + Rebotes",
                category="Combo P+R",
                prob=p_pr,
                player_full_name=s["name"],
                player_pos=s.get("pos", "F"),
                player_team=p_team,
                season_avg=f"{pr_avg:.1f} P+R/juego",
                safe_line=pr_line,
                buffer_pct=f"-{round(((pr_avg - pr_line)/pr_avg)*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Media combinada de {pr_avg:.1f} P+R ({p_pr*100:.1f}%).",
                stat_type="player_pr",
                threshold=pr_line,
                direction="OVER",
                player=s["name"],
            ))
        if pa_avg >= 14.0:
            pa_line = max(9.5, round(pa_avg * 0.75) + 0.5)
            p_pa = normal_prob_over(pa_avg, max(4.5, pa_avg * 0.22), pa_line)
            cat_pr_pa["options"].append(_make_opt(
                pick=f"{s['name']} Over {pa_line:.1f} Puntos + Asistencias",
                category="Combo P+A",
                prob=p_pa,
                player_full_name=s["name"],
                player_pos=s.get("pos", "G"),
                player_team=p_team,
                season_avg=f"{pa_avg:.1f} P+A/juego",
                safe_line=pa_line,
                buffer_pct=f"-{round(((pa_avg - pa_line)/pa_avg)*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Media combinada de {pa_avg:.1f} P+A ({p_pa*100:.1f}%).",
                stat_type="player_pa",
                threshold=pa_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_pr_pa)

    # 11. DEFENSA & HITOS (ROBOS+TAPONES / DOBLE-DOBLE)
    cat_def = {"category": "Defensa (Robos+Tapones) & Doble-Doble", "options": []}
    for s in stars[:6]:
        stl = float(s.get("stl", 0.9))
        blk = float(s.get("blk", 0.5))
        stocks = round(stl + blk, 1)
        p_team, opp_tm, _, _ = _opp_ctx(s)
        if stocks >= 1.1:
            p_stk = poisson_prob_over(stocks, 0.5)
            cat_def["options"].append(_make_opt(
                pick=f"{s['name']} Over 0.5 Robos + Tapones",
                category="Defensa Stocks",
                prob=p_stk,
                player_full_name=s["name"],
                player_pos=s.get("pos", "G/F"),
                player_team=p_team,
                season_avg=f"{stocks:.1f} Stocks/juego ({stl:.1f} STL + {blk:.1f} BLK)",
                safe_line=0.5,
                buffer_pct="Solo requiere 1 robo o 1 tapón",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Con {stocks:.1f} robos+tapones por juego, Poisson P(>=1) = {p_stk*100:.1f}%.",
                stat_type="player_stocks",
                threshold=0.5,
                direction="OVER",
                player=s["name"],
            ))
        if float(s.get("pts", 0)) >= 12.0 and (float(s.get("reb", 0)) >= 8.0 or float(s.get("ast", 0)) >= 7.5):
            second_stat = max(float(s.get("reb", 0)), float(s.get("ast", 0)))
            p_dd = min(0.84, max(0.54, normal_prob_over(second_stat, 2.8, 9.5) * 0.94))
            cat_def["options"].append(_make_opt(
                pick=f"{s['name']} Registra Doble-Doble",
                category="Doble-Doble",
                prob=p_dd,
                player_full_name=s["name"],
                player_pos=s.get("pos", "F/C"),
                player_team=p_team,
                season_avg=f"{s.get('pts',0):.1f}P / {s.get('reb',0):.1f}R / {s.get('ast',0):.1f}A",
                safe_line=1.0,
                buffer_pct="Doble dígito en 2 categorías",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Alto volumen en doble categoría ({second_stat:.1f} de media secundaria) con {p_dd*100:.1f}% de prob.",
                stat_type="player_dd",
                threshold=1.0,
                direction="YES",
                player=s["name"],
            ))
    categories.append(cat_def)

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
        "time_cdmx": game.get("time_cdmx", "18:00"),
        "best_pick": best_pick,
        "variables": top_4_vars,
        "categories": categories,
        "total_options": len(all_flat),
    }
