# -*- coding: utf-8 -*-
with open('src/pages/especialista/AgendaDiaria.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                                Nota para Recepción / Caja (Opcional)
                            </label>
                            <input"""

replacement = """                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-1.5 flex items-center justify-between">
                                <span>🩺 Indicaciones Concierge & Nota para Recepción</span>
                                <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md">Visible en la App del Paciente</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {[
                                    '💧 Tomar 2.5L de agua hoy',
                                    '🚫 Evitar vapor/sauna 24h',
                                    '🚶‍♀️ Caminata suave de 20 min',
                                    '🥗 Alimentación antiinflamatoria',
                                    '🧴 Aplicar gel reafirmante en zona'
                                ].map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setPaseNota(prev => prev ? `${prev}. ${chip}` : chip)}
                                        className="text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                    >
                                        + {chip}
                                    </button>
                                ))}
                            </div>
                            <input"""

if target in text:
    new_text = text.replace(target, replacement, 1)
    with open('src/pages/especialista/AgendaDiaria.jsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("AgendaDiaria updated successfully!")
else:
    print("Target not found in AgendaDiaria")
