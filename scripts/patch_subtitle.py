# -*- coding: utf-8 -*-
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_subtitle = '<p className="text-gray-400 mb-8 font-black uppercase text-[10px] tracking-[0.3em]">v18.12-STABLE</p>'
new_subtitle = """<p className="text-turquesa font-bold text-xs tracking-widest uppercase mb-1">Cirugía & Medicina Estética</p>
        <p className="text-gray-400 font-medium text-[11px] italic mb-7">"Resaltando tu bienestar y belleza natural"</p>"""

if old_subtitle in text:
    text = text.replace(old_subtitle, new_subtitle, 1)
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Subtitulo actualizado con leyenda del negocio.")
else:
    print("Error: old_subtitle no encontrado.")
