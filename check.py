# -*- coding: utf-8 -*-
with open('dashboard_copy.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Verify if the cards are there
if 'Card variant="default" className="relative overflow-hidden group border-turquesa/20"' in content:
    print("Found Ingreso Semanal card")
else:
    print("NOT FOUND Ingreso Semanal card")

if 'Card variant="default" className="relative overflow-hidden group border-red-100"' in content:
    print("Found Gasto Semanal card")
else:
    print("NOT FOUND Gasto Semanal card")

if 'Card key={label} variant="subtle"' in content:
    print("Found Agenda cards")
else:
    print("NOT FOUND Agenda cards")
