# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    orig_jsx = f.read()

target = '{activeTab ===  miprogreso && ('
pos = orig_jsx.find(target)
print('pos of miprogreso:', pos)

if pos != -1:
    tail_jsx = orig_jsx[pos:]
    with open('scripts/tail_jsx.txt', 'w', encoding='utf-8') as f_out:
        f_out.write(tail_jsx)
    print('Saved tail_jsx.txt, length:', len(tail_jsx))