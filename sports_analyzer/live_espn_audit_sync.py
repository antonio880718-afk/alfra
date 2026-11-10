# -*- coding: utf-8 -*-
"""
live_espn_audit_sync.py - Sincronizador Automático en Vivo desde ESPN API para Fútbol (26+ Ligas).
Actualiza cartelera_boxscores_YYYYMMDD.json y live_calendar_YYYYMMDD.json con marcadores reales,
córners, tarjetas, goles en 1T (HT), tiros a puerta y actas completas de jugadores (Starter/Sot/Goles/Asistencias)
para la evaluación empírica de la auditoría y la regla VOID.
"""
import os
import json
import urllib.request
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Optional

CDMX_TZ = timezone(timedelta(hours=-6))
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
}


def _safe_int(val: Any, default: int = 0) -> int:
    try:
        if val is None or val == "":
            return default
        return int(float(val))
    except Exception:
        return default


def _parse_espn_soccer_summary(m: Dict[str, Any], summary_data: Dict[str, Any], refs_db: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convierte el JSON oficial /summary de ESPN en el formato estándar de cartelera_boxscores."""
    if not summary_data:
        return None

    comp = summary_data.get("header", {}).get("competitions", [{}])[0]
    status_obj = comp.get("status", {})
    st_type = status_obj.get("type", {})
    st_state = str(st_type.get("state", "pre")).lower()
    st_desc = str(st_type.get("description", "Scheduled"))
    st_detail = str(st_type.get("shortDetail", st_desc))
    completed = bool(st_type.get("completed", False))

    h_name = m.get("home", "Local")
    a_name = m.get("away", "Visitante")
    league = m.get("league", "Liga Oficial")
    time_cdmx = m.get("time_cdmx", "12:00")

    competitors = comp.get("competitors", [])
    h_comp = next((c for c in competitors if c.get("homeAway") == "home"), {})
    a_comp = next((c for c in competitors if c.get("homeAway") == "away"), {})
    h_team_id = str(h_comp.get("team", {}).get("id", ""))
    a_team_id = str(a_comp.get("team", {}).get("id", ""))

    h_goals = _safe_int(h_comp.get("score"), 0)
    a_goals = _safe_int(a_comp.get("score"), 0)

    desc_up = st_desc.upper()
    if any(x in desc_up for x in ["POSTPONED", "CANCELED", "CANCELLED", "SUSPENDED", "ABANDONED"]):
        status_label = f"APLAZADO ({st_desc.upper()})"
    elif completed or st_state == "post":
        status_label = "FINALIZADO (FT)"
    elif st_state == "in":
        if "HALF" in desc_up or st_detail.upper() == "HT":
            status_label = "EN JUEGO (HT)"
        else:
            disp_clk = status_obj.get("displayClock") or st_detail
            status_label = f"EN JUEGO ({disp_clk})"
    else:
        status_label = f"PROGRAMADO ({time_cdmx} hs CDMX)"

    # Extraer goles en 1er Tiempo (HT) desde keyEvents o header.details
    ht_home = 0
    ht_away = 0
    key_events = summary_data.get("keyEvents", [])
    scored_from_key_events = False
    for ke in key_events:
        if ke.get("scoringPlay", False):
            scored_from_key_events = True
            period_num = _safe_int(ke.get("period", {}).get("number"), 0)
            clk_sec = float(ke.get("clock", {}).get("value", 0) or 0)
            if period_num == 1 or (period_num == 0 and clk_sec <= 2700.0):
                ev_tid = str(ke.get("team", {}).get("id", ""))
                ev_tname = str(ke.get("team", {}).get("displayName", "")).lower()
                if (h_team_id and ev_tid == h_team_id) or (h_name.lower() in ev_tname):
                    ht_home += 1
                elif (a_team_id and ev_tid == a_team_id) or (a_name.lower() in ev_tname):
                    ht_away += 1

    if not scored_from_key_events:
        for dt_item in comp.get("details", []):
            if dt_item.get("scoringPlay", False):
                clk_sec = float(dt_item.get("clock", {}).get("value", 0) or 0)
                clk_disp = str(dt_item.get("clock", {}).get("displayValue", ""))
                is_1h = (clk_sec <= 2700.0 and not clk_disp.startswith("46") and not clk_disp.startswith("90"))
                if is_1h or clk_disp.startswith("45'+"):
                    ev_tid = str(dt_item.get("team", {}).get("id", ""))
                    if h_team_id and ev_tid == h_team_id:
                        ht_home += 1
                    elif a_team_id and ev_tid == a_team_id:
                        ht_away += 1

    # Si no hubo desglose temporal pero el partido ya finalizó y hubo goles sin detalles HT
    ht_goals = ht_home + ht_away

    # Extraer estadísticas de equipo (Córners, Tarjetas, Tiros a Puerta, Faltas)
    h_corners = a_corners = 0
    h_yellow = a_yellow = 0
    h_red = a_red = 0
    h_sot = a_sot = 0
    h_fouls = a_fouls = 0
    h_offsides = a_offsides = 0
    h_shots = a_shots = 0

    for bt in summary_data.get("boxscore", {}).get("teams", []):
        bt_id = str(bt.get("team", {}).get("id", ""))
        bt_name = str(bt.get("team", {}).get("displayName", "")).lower()
        is_home_bt = (bt.get("homeAway") == "home") or (h_team_id and bt_id == h_team_id) or (h_name.lower() in bt_name)
        st_map = {s.get("name"): s.get("displayValue") for s in bt.get("statistics", []) if s.get("name")}
        c_val = _safe_int(st_map.get("wonCorners"), 0)
        y_val = _safe_int(st_map.get("yellowCards"), 0)
        r_val = _safe_int(st_map.get("redCards"), 0)
        sot_val = _safe_int(st_map.get("shotsOnTarget"), 0)
        f_val = _safe_int(st_map["foulsCommitted"]) if "foulsCommitted" in st_map else None
        o_val = _safe_int(st_map["offsides"]) if "offsides" in st_map else None
        sh_val = _safe_int(st_map["totalShots"]) if "totalShots" in st_map else None

        if is_home_bt:
            h_corners, h_yellow, h_red, h_sot, h_fouls, h_offsides, h_shots = c_val, y_val, r_val, sot_val, f_val, o_val, sh_val
        else:
            a_corners, a_yellow, a_red, a_sot, a_fouls, a_offsides, a_shots = c_val, y_val, r_val, sot_val, f_val, o_val, sh_val

    h_cards = h_yellow + h_red
    a_cards = a_yellow + a_red

    # Árbitro oficial
    ref_name = ""
    officials = summary_data.get("gameInfo", {}).get("officials", [])
    if officials:
        ref_name = officials[0].get("displayName", "")
    if not ref_name:
        m_key = f"{h_name} vs {a_name}".lower().strip()
        ref_entry = refs_db.get(m_key, {})
        if isinstance(ref_entry, dict):
            ref_name = ref_entry.get("name", "")
        elif isinstance(ref_entry, str):
            ref_name = ref_entry

    # Estadísticas individuales de jugadores (Alineación Titular XI + Tiros a Puerta + Goles + Asistencias)
    player_stats: Dict[str, Any] = {}
    for ros in summary_data.get("rosters", []):
        ros_tid = str(ros.get("team", {}).get("id", ""))
        ros_tname = ros.get("team", {}).get("displayName") or (h_name if ros_tid == h_team_id else a_name)
        for p in ros.get("roster", []):
            p_name = p.get("athlete", {}).get("displayName", "").strip()
            if not p_name:
                continue
            starter = bool(p.get("starter", False))
            subbed_in = bool(p.get("subbedIn", False))
            raw_stats = {s.get("name"): s.get("value") for s in p.get("stats", []) if s.get("name")}
            has_sot_key = ("shotsOnTarget" in raw_stats) or ("totalShots" in raw_stats)
            app_val = float(raw_stats.get("appearances", 0) or 0)
            played = starter or subbed_in or (app_val > 0)
            mins = 90 if starter else (25 if played else 0)
            player_stats[p_name] = {
                "team": ros_tname,
                "sot": _safe_int(raw_stats.get("shotsOnTarget"), 0),
                "total_shots": _safe_int(raw_stats.get("totalShots"), 0),
                "goals": _safe_int(raw_stats.get("totalGoals"), 0),
                "assists": _safe_int(raw_stats.get("goalAssists"), 0),
                "started": starter,
                "played": played,
                "mins": mins,
                "opta_tracked": has_sot_key,
            }

    score_str = f"{h_goals} - {a_goals}" if (completed or st_state in ("in", "post")) else "vs"

    return {
        "match": f"{h_name} vs {a_name}",
        "league": league,
        "status": status_label,
        "time_cdmx": time_cdmx,
        "score": score_str,
        "home_goals": h_goals,
        "away_goals": a_goals,
        "ht_home": ht_home,
        "ht_away": ht_away,
        "ht_goals": ht_goals,
        "home_corners": h_corners,
        "away_corners": a_corners,
        "total_corners": h_corners + a_corners,
        "home_cards": h_cards,
        "away_cards": a_cards,
        "total_cards": h_cards + a_cards,
        "home_sot": h_sot,
        "away_sot": a_sot,
        "home_fouls": h_fouls,
        "away_fouls": a_fouls,
        "total_fouls": (h_fouls + a_fouls) if (h_fouls is not None and a_fouls is not None) else None,
        "home_offsides": h_offsides,
        "away_offsides": a_offsides,
        "total_offsides": (h_offsides + a_offsides) if (h_offsides is not None and a_offsides is not None) else None,
        "home_shots": h_shots,
        "away_shots": a_shots,
        "total_shots": (h_shots + a_shots) if (h_shots is not None and a_shots is not None) else None,
        "btts": (h_goals > 0 and a_goals > 0),
        "referee": ref_name or "Árbitro Oficial Designado",
        "player_stats": player_stats,
        "source": "ESPN / SofaScore Official Match Center (Sync en Vivo)",
        "_espn_state": st_state,
    }


def _fetch_single_event_summary(m: Dict[str, Any], refs_db: Dict[str, Any]) -> tuple:
    eid = str(m.get("id", ""))
    code = str(m.get("code", ""))
    if not eid or not code or "_" in eid:
        return m, None
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/summary?event={eid}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as r:
            s_data = json.loads(r.read().decode("utf-8"))
        parsed = _parse_espn_soccer_summary(m, s_data, refs_db)
        return m, parsed
    except Exception:
        return m, None


def sync_soccer_date_from_espn(date_str: str, force: bool = False) -> Dict[str, Any]:
    """
    Sincroniza en paralelo desde ESPN los marcadores y boxscores completos para date_str (YYYYMMDD).
    Retorna resumen de partidos actualizados y finalizados.
    """
    cal_path = os.path.join(DATA_DIR, f"live_calendar_{date_str}.json")
    bs_path = os.path.join(DATA_DIR, f"cartelera_boxscores_{date_str}.json")
    refs_path = os.path.join(DATA_DIR, "cartelera_official_referees.json")

    if not os.path.exists(cal_path):
        return {"date_str": date_str, "updated": 0, "finalized": 0, "live": 0, "scheduled": 0, "skipped": True}

    try:
        with open(cal_path, "r", encoding="utf-8") as f:
            calendar = json.load(f)
    except Exception:
        return {"date_str": date_str, "updated": 0, "finalized": 0, "live": 0, "scheduled": 0, "skipped": True}

    existing_bs: Dict[str, Any] = {}
    if os.path.exists(bs_path):
        try:
            with open(bs_path, "r", encoding="utf-8") as f:
                existing_bs = json.load(f)
        except Exception:
            existing_bs = {}

    refs_db: Dict[str, Any] = {}
    if os.path.exists(refs_path):
        try:
            with open(refs_path, "r", encoding="utf-8") as f:
                refs_db = json.load(f)
        except Exception:
            refs_db = {}

    now_cdmx = datetime.now(CDMX_TZ)
    today_str = now_cdmx.strftime("%Y%m%d")
    now_mins = now_cdmx.hour * 60 + now_cdmx.minute

    to_fetch: List[Dict[str, Any]] = []
    for m in calendar:
        m_key = f"{m.get('home', '').strip()} vs {m.get('away', '').strip()}".lower()
        prev = existing_bs.get(m_key, {})
        prev_status = str(prev.get("status", ""))
        already_ft = ("FINALIZADO" in prev_status and len(prev.get("player_stats", {})) > 0)
        already_postponed = ("APLAZADO" in prev_status)

        if not force and (already_ft or already_postponed):
            continue

        # Si es fecha futura (> hoy CDMX), no hacer peticiones HTTP innecesarias
        if not force and date_str > today_str:
            continue

        # Si es HOY y el partido aún empieza dentro de más de 15 minutos, no perder tiempo salvo force
        if not force and date_str == today_str:
            t_str = str(m.get("time_cdmx", "12:00"))
            try:
                hh, mm = [int(x) for x in t_str.split(":")[:2]]
                k_mins = hh * 60 + mm
                if now_mins < (k_mins - 15) and m_key in existing_bs:
                    continue
            except Exception:
                pass

        to_fetch.append(m)

    updated_count = 0
    if to_fetch:
        with ThreadPoolExecutor(max_workers=10) as ex:
            futures = [ex.submit(_fetch_single_event_summary, m, refs_db) for m in to_fetch]
            for fut in as_completed(futures):
                m_item, parsed = fut.result()
                if parsed:
                    m_key = f"{m_item.get('home', '').strip()} vs {m_item.get('away', '').strip()}".lower()
                    espn_state = parsed.pop("_espn_state", "pre")
                    existing_bs[m_key] = parsed
                    updated_count += 1

                    # Sincronizar también campos del calendario en vivo
                    m_item["status_text"] = parsed["status"]
                    m_item["espn_state"] = espn_state
                    m_item["home_goals"] = parsed["home_goals"]
                    m_item["away_goals"] = parsed["away_goals"]
                    m_item["ht_home"] = parsed["ht_home"]
                    m_item["ht_away"] = parsed["ht_away"]
                    m_item["home_corners"] = parsed["home_corners"]
                    m_item["away_corners"] = parsed["away_corners"]
                    m_item["home_cards"] = parsed["home_cards"]
                    m_item["away_cards"] = parsed["away_cards"]
                    m_item["home_sot"] = parsed["home_sot"]
                    m_item["away_sot"] = parsed["away_sot"]

    if updated_count > 0 or not os.path.exists(bs_path):
        try:
            with open(bs_path, "w", encoding="utf-8") as f:
                json.dump(existing_bs, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        if updated_count > 0:
            try:
                with open(cal_path, "w", encoding="utf-8") as f:
                    json.dump(calendar, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

        try:
            from automated_self_audit_engine import invalidate_audit_cache
            invalidate_audit_cache()
        except Exception:
            pass

    fin_cnt = sum(1 for v in existing_bs.values() if "FINALIZADO" in str(v.get("status", "")))
    live_cnt = sum(1 for v in existing_bs.values() if "EN JUEGO" in str(v.get("status", "")))
    sched_cnt = sum(1 for v in existing_bs.values() if "PROGRAMADO" in str(v.get("status", "")))

    return {
        "date_str": date_str,
        "updated": updated_count,
        "total_boxscores": len(existing_bs),
        "finalized": fin_cnt,
        "live": live_cnt,
        "scheduled": sched_cnt,
        "synced_at": now_cdmx.strftime("%H:%M:%S CDMX"),
    }


def sync_recent_dates_if_stale(date_str: str, max_age_sec: int = 120) -> Dict[str, Any]:
    """
    Sincroniza automáticamente si:
    1. No existe cartelera_boxscores_{date_str}.json, o
    2. El archivo tiene partidos no finalizados (EN JUEGO / PROGRAMADO ya vencidos) y han pasado > max_age_sec desde el último sync.
    """
    now_cdmx = datetime.now(CDMX_TZ)
    today_str = now_cdmx.strftime("%Y%m%d")
    if date_str > today_str:
        return {"date_str": date_str, "updated": 0, "skipped": True}

    bs_path = os.path.join(DATA_DIR, f"cartelera_boxscores_{date_str}.json")
    cal_path = os.path.join(DATA_DIR, f"live_calendar_{date_str}.json")
    if not os.path.exists(cal_path):
        return {"date_str": date_str, "updated": 0, "skipped": True}

    needs_sync = False
    if not os.path.exists(bs_path):
        needs_sync = True
    else:
        age = datetime.now().timestamp() - os.path.getmtime(bs_path)
        if age >= max_age_sec:
            try:
                with open(cal_path, "r", encoding="utf-8") as cf:
                    cal_len = len(json.load(cf))
                with open(bs_path, "r", encoding="utf-8") as bf:
                    bs_data = json.load(bf)
                if len(bs_data) < cal_len:
                    needs_sync = True
                elif any("EN JUEGO" in str(v.get("status", "")) for v in bs_data.values()):
                    needs_sync = True
                elif date_str < today_str and any("PROGRAMADO" in str(v.get("status", "")) for v in bs_data.values()):
                    needs_sync = True
                elif date_str == today_str:
                    # Revisar si algún partido programado ya alcanzó su hora de inicio (CDMX)
                    now_mins = now_cdmx.hour * 60 + now_cdmx.minute
                    for v in bs_data.values():
                        if "PROGRAMADO" in str(v.get("status", "")):
                            t_str = str(v.get("time_cdmx", "12:00"))
                            try:
                                hh, mm = [int(x) for x in t_str.split(":")[:2]]
                                if now_mins >= (hh * 60 + mm):
                                    needs_sync = True
                                    break
                            except Exception:
                                pass
            except Exception:
                needs_sync = True

    if needs_sync:
        return sync_soccer_date_from_espn(date_str, force=False)
    return {"date_str": date_str, "updated": 0, "skipped": False, "up_to_date": True}


if __name__ == "__main__":
    import sys
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["20261109", "20261110"]
    for d in targets:
        res = sync_soccer_date_from_espn(d, force=True)
        print(f"Sync {d}: {res}")
