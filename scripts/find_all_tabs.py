# -*- coding: utf-8 -*-
with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Total lines in part_jsx.txt:', len(lines))
for i, line in enumerate(lines):
    if 'activeTab' in line:
        print(f'{i+1}: {repr(line)}')