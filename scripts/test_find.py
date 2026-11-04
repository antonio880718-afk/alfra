import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    orig_jsx = f.read()

idx_miprogreso = orig_jsx.find('{activeTab === " miprogreso\ && (')
print('idx_miprogreso:', idx_miprogreso)

idx_citas = orig_jsx.find('{activeTab === \citas\ && (')
print('idx_citas:', idx_citas)

idx_exp = orig_jsx.find('{activeTab === \expediente\ && (')
print('idx_exp:', idx_exp)

idx_pagos = orig_jsx.find('{activeTab === \pagos\ && (')
print('idx_pagos:', idx_pagos)

idx_config = orig_jsx.find('{activeTab === \config\ && (')
print('idx_config:', idx_config)
