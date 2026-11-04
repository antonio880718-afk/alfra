# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Starting rearrangement...')

# Hero Header: lines 0 to 71
hero_header_lines = lines[0:71]
hero_header = ''.join(hero_header_lines)
hero_header = hero_header.replace('> Concierge', '> Atención Personalizada')
hero_header = hero_header.replace('Concierge', 'Panel')
hero_header = hero_header.replace('Índice de Bienestar ALFRA: 94% · Excelente Respuesta', 'Índice de Bienestar ALFRA: {indiceBienestar}% · {indiceBienestar >= 85 ? " Nivel Óptimo\ : indiceBienestar >= 70 ? \Excelente Ritmo\ : \Activo\}')

# Tabs: lines 313 to 336
tabs_lines = lines[313:336]
tabs_str = ''.join(tabs_lines)

# Modo Bienvenida: lines 71 to 100
bienvenida_lines = lines[71:100]
bienvenida_str = ''.join(bienvenida_lines)

# Roadmap: lines 100 to 175
roadmap_lines = lines[100:175]
roadmap_str = ''.join(roadmap_lines)

print('Extracted Hero, Tabs, Bienvenida, Roadmap.')