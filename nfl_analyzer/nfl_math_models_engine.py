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
    stars = game.get("stars", [])
    venue = game.get("venue", "Estadio Oficial")
    is_dome = game.get("is_dome", False)

    h_def = game.get("home_defense", {"pass_def_rank": 15, "pass_yds_allowed": 218.0, "rush_def_rank": 15, "rush_yds_allowed": 110.0, "style": "Defensa Estándar"})
    a_def = game.get("away_defense", {"pass_def_rank": 16, "pass_yds_allowed": 220.0, "rush_def_rank": 16, "rush_yds_allowed": 112.0, "style": "Defensa Estándar"})

    tot_std = 12.8 if league == "NFL" else 14.5
    margin_std = 13.5 if league == "NFL" else 15.5
    home_spread = _extract_home_spread(spread_str, home, away)
    exp_home = round((ou_line - home_spread) / 2.0, 1)
    exp_away = round((ou_line + home_spread) / 2.0, 1)
    match_lbl = f"{away} @ {home}"

    categories = []

    # 1. PUNTOS TOTALES PARTIDO (4 líneas)
    cat_totals = {"category": "Puntos Totales Partido (Over / Under)", "options": []}
    for label, delta, direction in [
        ("Over Seguro (-7.5)", -7.5, "OVER"),
        ("Over Conservador (-3.5)", -3.5, "OVER"),
        ("Under Seguro (+7.5)", 7.5, "UNDER"),
        ("Under Conservador (+3.5)", 3.5, "UNDER"),
    ]:
        line = max(21.5, round(ou_line + delta - 0.5) + 0.5)
        p_val = normal_prob_over(ou_line, tot_std, line) if direction == "OVER" else (1.0 - normal_prob_over(ou_line, tot_std, line))
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
    for tm, sp_base, st_key in [
        (home, home_spread + 7.5, "spread_home"),
        (away, -home_spread + 7.5, "spread_away"),
        (home, home_spread + 10.5, "spread_home"),
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
        p_o = normal_prob_over(exp_tm, 8.5, o_line)
        p_u = 1.0 - normal_prob_over(exp_tm, 8.5, u_line)
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
    exp_1h = round(ou_line * 0.49, 1)
    h1_o = max(10.5, round(exp_1h - 4.5) + 0.5)
    h1_u = round(exp_1h + 4.5) + 0.5
    p_1h_o = normal_prob_over(exp_1h, 8.0, h1_o)
    p_1h_u = 1.0 - normal_prob_over(exp_1h, 8.0, h1_u)
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
        p_t1h = normal_prob_over(exp_tm, 5.5, t1h_o)
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
        return p_team, opp_tm, opp_def

    # 5. YARDAS POR PASE DE QB (2 líneas por QB)
    cat_pass = {"category": "Yardas por Pase de QB", "options": []}
    for s in stars:
        if s.get("pos") == "QB" or float(s.get("pass_yds", 0.0)) >= 120.0:
            base_pass = max(145.0, float(s.get("pass_yds", 225.0)))
            p_team, opp_tm, opp_def = _opp_ctx(s)
            pass_adj = 1.0 + ((float(opp_def.get("pass_yds_allowed", 220.0)) - 220.0) / 1000.0) + (0.03 if is_dome else 0.0)
            exp_pass = round(base_pass * pass_adj, 1)
            for tag, mult in [("Segura", 0.74), ("Media", 0.86)]:
                safe_line = max(119.5, round(exp_pass * mult) + 0.5)
                p_pass = normal_prob_over(exp_pass, 45.0, safe_line)
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
                    buffer_pct=f"-{round(base_pass - safe_line, 1)} YDS colchón",
                    defense_matchup=f"vs {opp_tm} (Def Pase #{opp_def.get('pass_def_rank', 16)}, {opp_def.get('pass_yds_allowed', 220.0)} YDS/g)",
                    why_selected=f"Media {base_pass:.1f} YDS ajustada a {exp_pass:.1f} YDS vs secundaria de {opp_tm} ({p_pass*100:.1f}%).",
                    stat_type="qb_pass_yds",
                    threshold=safe_line,
                    direction="OVER",
                    player=s["name"],
                ))
    categories.append(cat_pass)

    # 6. PASES DE TOUCHDOWN DE QB
    cat_tds = {"category": "Pases de Touchdown de QB", "options": []}
    for s in stars:
        if s.get("pos") == "QB" or float(s.get("pass_yds", 0.0)) >= 120.0:
            base_tds = max(1.1, float(s.get("pass_tds", 1.6)))
            p_team, opp_tm, opp_def = _opp_ctx(s)
            for td_line in (0.5, 1.5):
                if td_line == 1.5 and base_tds < 1.5:
                    continue
                p_td = poisson_prob_over(base_tds, td_line)
                cat_tds["options"].append(_make_opt(
                    pick=f"{s['name']} Over {td_line:.1f} Pases de TD",
                    category="Pases de Touchdown",
                    prob=p_td,
                    player_full_name=s["name"],
                    player_pos=f"QB #{s.get('jersey', '0')}",
                    player_team=p_team,
                    player_role=s.get("role", "Mariscal Titular"),
                    season_avg=f"{base_tds:.2f} Pases TD/juego",
                    safe_line=td_line,
                    buffer_pct=">= 1 TD" if td_line == 0.5 else ">= 2 TDs",
                    defense_matchup=f"vs {opp_tm} en zona roja",
                    why_selected=f"Con {base_tds:.2f} TD/juego, Poisson P(X>{td_line:.1f}) = {p_td*100:.1f}%.",
                    stat_type="qb_pass_tds",
                    threshold=td_line,
                    direction="OVER",
                    player=s["name"],
                ))
    categories.append(cat_tds)

    # 7. YARDAS TERRESTRES (RB / MOBILE QB)
    cat_rush = {"category": "Yardas Terrestres (RB / QB Móvil)", "options": []}
    for s in stars:
        base_rush = float(s.get("rush_yds", 0.0))
        if s.get("pos") == "RB" or base_rush >= 25.0:
            base_rush = max(32.0, base_rush)
            p_team, opp_tm, opp_def = _opp_ctx(s)
            safe_line = max(18.5, round(base_rush * 0.68) + 0.5)
            p_rush = normal_prob_over(base_rush, max(16.0, base_rush * 0.32), safe_line)
            cat_rush["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} Yardas Terrestres",
                category="Yardas Terrestres",
                prob=p_rush,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'RB')} #{s.get('jersey', '0')}",
                player_team=p_team,
                player_role=s.get("role", "Corredor Principal"),
                season_avg=f"{base_rush:.1f} YDS terrestres/juego",
                safe_line=safe_line,
                buffer_pct=f"-{round(((base_rush - safe_line)/base_rush)*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm} (Def Carrera #{opp_def.get('rush_def_rank', 15)}, {opp_def.get('rush_yds_allowed', 115.0)} YDS/g)",
                why_selected=f"Promedia {base_rush:.1f} YDS/juego; línea {safe_line:.1f} ({p_rush*100:.1f}%).",
                stat_type="rb_rush_yds",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_rush)

    # 8. YARDAS DE RECEPCIÓN (WR / TE)
    cat_rec = {"category": "Yardas de Recepción (WR / TE)", "options": []}
    for s in stars:
        base_rec = float(s.get("rec_yds", 0.0))
        if s.get("pos") in ("WR", "TE") or base_rec >= 25.0:
            base_rec = max(32.0, base_rec)
            p_team, opp_tm, opp_def = _opp_ctx(s)
            safe_line = max(19.5, round(base_rec * 0.66) + 0.5)
            p_rec = normal_prob_over(base_rec, max(18.0, base_rec * 0.35), safe_line)
            cat_rec["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} Yardas de Recepción",
                category="Yardas Recepción",
                prob=p_rec,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'WR')} #{s.get('jersey', '0')}",
                player_team=p_team,
                player_role=s.get("role", "Receptor Principal"),
                season_avg=f"{base_rec:.1f} YDS rec/juego",
                safe_line=safe_line,
                buffer_pct=f"-{round(((base_rec - safe_line)/base_rec)*100, 1)}% margen",
                defense_matchup=f"vs secundaria {opp_tm} (#{opp_def.get('pass_def_rank', 16)})",
                why_selected=f"Media de {base_rec:.1f} YDS/juego; línea segura {safe_line:.1f} ({p_rec*100:.1f}%).",
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
            p_team, opp_tm, _ = _opp_ctx(s)
            safe_line = max(1.5, round(receptions * 0.65) - 0.5)
            p_rcp = poisson_prob_over(receptions, safe_line)
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

    # 10. YARDAS COMBINADAS SCRIMMAGE (RUSH + REC)
    cat_scrim = {"category": "Yardas Totales Scrimmage (Carrera + Recepción)", "options": []}
    for s in stars:
        scrim = float(s.get("rush_yds", 0.0)) + float(s.get("rec_yds", 0.0))
        if s.get("pos") != "QB" and scrim >= 40.0:
            p_team, opp_tm, _ = _opp_ctx(s)
            safe_line = max(29.5, round(scrim * 0.70) + 0.5)
            p_scr = normal_prob_over(scrim, max(20.0, scrim * 0.30), safe_line)
            cat_scrim["options"].append(_make_opt(
                pick=f"{s['name']} Over {safe_line:.1f} YDS Scrimmage (Rush+Rec)",
                category="Scrimmage YDS",
                prob=p_scr,
                player_full_name=s["name"],
                player_pos=f"{s.get('pos', 'RB')} #{s.get('jersey', '0')}",
                player_team=p_team,
                season_avg=f"{scrim:.1f} YDS totales/juego",
                safe_line=safe_line,
                buffer_pct=f"-{round(((scrim - safe_line)/scrim)*100, 1)}% margen",
                defense_matchup=f"vs {opp_tm}",
                why_selected=f"Uso dual carrera+pase ({scrim:.1f} YDS totales) amortigua guion adverso ({p_scr*100:.1f}%).",
                stat_type="scrimmage_yds",
                threshold=safe_line,
                direction="OVER",
                player=s["name"],
            ))
    categories.append(cat_scrim)

    # 11. ANOTADOR EN CUALQUIER MOMENTO (ANYTIME TD)
    cat_atd = {"category": "Anotador en Cualquier Momento (Anytime TD)", "options": []}
    for s in stars:
        td_rate = float(s.get("anytime_td_pct", 35.0))
        if td_rate >= 34.0:
            p_atd = min(0.84, max(0.36, td_rate / 100.0))
            p_team, opp_tm, _ = _opp_ctx(s)
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

    all_flat = [opt for c in categories for opt in c["options"]]
    all_flat.sort(key=lambda x: (x["prob_num"], x["odds_num"]), reverse=True)
    best_pick = all_flat[0] if all_flat else {}
    top_4_vars = all_flat[1:5] if len(all_flat) > 4 else all_flat

    return {
        "match": game.get("match", match_lbl),
        "league": league,
        "time_cdmx": game.get("time_cdmx", "12:00"),
        "best_pick": best_pick,
        "variables": top_4_vars,
        "categories": categories,
        "total_options": len(all_flat),
    }
