with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Line count:', len(lines))
for i in [0, 5, 57, 71, 100, 175, 183, 313, 336, 461, 689, 825, 877, 940]:
    if i < len(lines):
        print(f'{i+1}: {lines[i].strip()[:80]}')