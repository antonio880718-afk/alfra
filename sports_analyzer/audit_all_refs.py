import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, 'sports_analyzer')
from hourly_slots_engine import get_chronological_slots
from referee_and_injuries_engine import get_referee_for_match

slots = get_chronological_slots()
generic_ref_count = 0
errors = []

for s in slots['slots']:
    for m in s.get('matches', []):
        h = m.get('home')
        a = m.get('away')
        code = m.get('code', '')
        l = m.get('league')
        if not h or not a: continue
        r = get_referee_for_match(h, a, code)
        r_name = r.get('name', '')
        if "Árbitro Promedio" in r_name or "Promedio Oficial" in r_name or not r_name:
            generic_ref_count += 1
            errors.append(f"[{l}] {h} vs {a} -> {r_name}")

print(f"Matches with non-specific referee: {generic_ref_count} / 116")
for e in errors[:15]:
    print("  ⚠️", e)
