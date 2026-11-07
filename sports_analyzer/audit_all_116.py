import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, 'sports_analyzer')
from hourly_slots_engine import get_chronological_slots
from referee_and_injuries_engine import get_match_injuries_report
from match_data_engineering_engine import compute_full_match_data_engineering

slots = get_chronological_slots()
all_matches = []
for s in slots['slots']:
    for m in s.get('matches', []):
        all_matches.append((m.get('home'), m.get('away'), m.get('league'), m.get('code', '')))

print(f"Total matches in cartelera: {len(all_matches)}")

generic_inj_count = 0
generic_starters_count = 0
errors = []

for h, a, l, c in all_matches:
    if not h or not a:
        continue
    try:
        rep = get_match_injuries_report(h, a)
        h_starters = rep.get('home_starters_ready', [])
        a_starters = rep.get('away_starters_ready', [])
        
        # Check for generic placeholders
        for s in h_starters + a_starters:
            if "Titular" in s or "Referente" in s or "Principal" in s or "Convocatoria Oficial" in s:
                errors.append(f"[{l}] {h} vs {a} -> Generic placeholder in starters: '{s}'")
                generic_starters_count += 1
                break
    except Exception as ex:
        errors.append(f"[{l}] {h} vs {a} -> Exception: {ex}")

print(f"Matches with generic starters: {generic_starters_count} / {len(all_matches)}")
for err in errors[:30]:
    print("  ❌", err)
