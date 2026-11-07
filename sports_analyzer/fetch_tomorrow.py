import sys
sys.path.append('sports_analyzer')
from multi_league_engine import fetch_league_games_by_date, LEAGUES_CONFIG

date_str = '20261107'
total_matches = []
for l in LEAGUES_CONFIG:
    try:
        evs = fetch_league_games_by_date(l['code'], date_str)
        for e in evs:
            comp = e.get('competitions', [{}])[0]
            competitors = comp.get('competitors', [])
            if len(competitors) >= 2:
                h = competitors[0]['team']['displayName'] if competitors[0]['homeAway'] == 'home' else competitors[1]['team']['displayName']
                a = competitors[1]['team']['displayName'] if competitors[0]['homeAway'] == 'home' else competitors[0]['team']['displayName']
                time_str = e.get('date', '')[11:16]
                total_matches.append({'league': l['name'], 'home': h, 'away': a, 'time': time_str})
    except Exception as ex:
        pass

print(f"Partidos oficiales encontrados para mañana (2026-11-07): {len(total_matches)}")
for m in total_matches:
    print(f"[{m['league']}] {m['home']} vs {m['away']} (Hora: {m['time']})")