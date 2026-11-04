# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("src/pages/paciente/PacienteProfile.jsx", "r", encoding="utf-8") as f:
    code = f.read()

target = "{/* POINT 3: GRÁFICA DE CALORÍAS COMPLETA EN ESTILO DE VIDA */}"

metabolic_card_jsx = """          {/* PRESCRIPCIÓN METABÓLICA Y CALÓRICA ULTRA HD (CIENTÍFICAMENTE VALIDADA) */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-2xl border-2 border-teal-500/30 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0 shadow-inner">
                  <Activity size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                      Algoritmo Mifflin-St Jeor & Bioestética ALFRA
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                      diagnosticoMetabolico.esPrescripcionManual 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {diagnosticoMetabolico.esPrescripcionManual ? '📋 Prescripción de Especialista' : '🧬 Cálculo Algorítmico Personalizado'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">Prescripción Calórica & Macronutrientes</h3>
                  <p className="text-xs text-teal-200/80 font-medium">Diseñada para maximizar la oxidación de grasa y prevenir la flacidez dérmica</p>
                </div>
              </div>
              <div className="bg-teal-500/10 border border-teal-400/30 rounded-2xl px-4 py-2 text-center sm:text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Meta Prescrita</span>
                <p className="text-3xl font-black text-white tracking-tight">{META_CALORIAS} <span className="text-xs text-teal-300 font-bold">kcal/día</span></p>
              </div>
            </div>

            {/* FÓRMULA CLÍNICA PASO A PASO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">1. Tasa Metabólica Basal (TMB)</p>
                <p className="text-xl font-black text-teal-300 mt-1">{diagnosticoMetabolico.tmb} <span className="text-xs font-normal">kcal</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">Energía vital en reposo ({diagnosticoMetabolico.peso} kg · {diagnosticoMetabolico.estatura} cm · {diagnosticoMetabolico.edad} años)</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">2. Gasto Total Diario (TDEE)</p>
                <p className="text-xl font-black text-cyan-300 mt-1">{diagnosticoMetabolico.tdee} <span className="text-xs font-normal">kcal</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">Gasto con {diagnosticoMetabolico.nivelActividadTexto}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">3. Ajuste por Tratamiento</p>
                <p className={`text-xl font-black mt-1 ${diagnosticoMetabolico.deficitKcal < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diagnosticoMetabolico.deficitKcal === 0 ? 'Isocalórico (0 kcal)' : `${diagnosticoMetabolico.deficitKcal} kcal`}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{diagnosticoMetabolico.objetivoClinico}</p>
              </div>
            </div>

            {/* FUNDAMENTO MÉDICO EXPLICADO AL PACIENTE */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-100/90 leading-relaxed">
              <p className="font-black text-teal-300 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                <Sparkles size={13} /> Justificación Científica para tu Éxito
              </p>
              <p>{diagnosticoMetabolico.razonClinica}</p>
            </div>

            {/* DISTRIBUCIÓN DE MACRONUTRIENTES CIENTÍFICOS (MACRO-SPLIT) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Flame size={14} className="text-orange-400" /> Distribución de Macronutrientes Diarios
                </h4>
                <span className="text-[10px] font-bold text-gray-400">Optimizado para definición corporal</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Proteína */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-400">🥩 Proteína (1.6 g/kg)</span>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.proteina.pct}%</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.proteina} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.proteina.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.proteina / Math.max(1, diagnosticoMetabolico.macros.proteina.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Escudo antiflacidez. Materia prima para que la piel se compacte y pegue al músculo.</p>
                </div>

                {/* Grasas Saludables */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-300">🥑 Grasas Saludables (25%)</span>
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.grasas.pct}%</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.grasas} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.grasas.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.grasas / Math.max(1, diagnosticoMetabolico.macros.grasas.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Esenciales para síntesis hormonal, salud celular y flexibilidad dérmica.</p>
                </div>

                {/* Carbohidratos Complejos */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-cyan-300">🌾 Carbohidratos Complejos</span>
                    <span className="text-[10px] font-black bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.carbs.pct}%</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.carbs} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.carbs.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.carbs / Math.max(1, diagnosticoMetabolico.macros.carbs.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Energía sostenida de bajo índice glucémico para evitar glicación del colágeno.</p>
                </div>
              </div>
            </div>
          </div>\n\n"""

code = code.replace(target, metabolic_card_jsx + target)

with open("src/pages/paciente/PacienteProfile.jsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Inserted Prescripción Metabólica Ultra HD Card!")