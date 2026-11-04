# -*- coding: utf-8 -*-
with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'expediente' in line:
        print(f'{i+1}: {repr(line)}')