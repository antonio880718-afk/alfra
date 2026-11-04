# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import render_html_to_pdf
from manual_data_common import load_logo, get_common_css, render_cover

logo = load_logo()
html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{get_common_css()}</style></head><body>
{render_cover(logo, 'PRUEBA MOTOR PYTHON', 'Subtítulo', 'Resumen', 'Administrador')}
</body></html>"""

render_html_to_pdf(html, 'manuales/test_python_pdf.pdf')
print('Existe:', os.path.exists('manuales/test_python_pdf.pdf'))
if os.path.exists('manuales/test_python_pdf.pdf'):
    os.remove('manuales/test_python_pdf.pdf')