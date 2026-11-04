# -*- coding: utf-8 -*-
chunk2 = """
      {/* 3. ROADMAP DE TRANSFORMACIÓN CLÍNICA (TREATMENT JOURNEY) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-turquesa" />
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Tu Roadmap de Transformación Clínica</h3>
            </div>
            <p className="text-xs text-gray-500 font-medium">Sigue de cerca en qué fase biológica se encuentra tu cuerpo</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-turquesa bg-turquesa/10 px-3 py-1 rounded-full border border-turquesa/20">
              {totalSesiones} Sesiones Realizadas · {progresoGlobalPct}% del Plan Maestro
            </span>
          </div>
        </div>

        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-teal-400 via-turquesa to-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm"
            style={{ width: `${progresoGlobalPct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {roadmapFases.map((fase) => {
            const Icon = fase.icono;
            return (
              <div 
                key={fase.num}
                onClick={() => setFaseInfoModal(fase)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  fase.activa 
                    ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-400 shadow-md ring-2 ring-teal-400/20' 
                    : fase.completada
                    ? 'bg-gray-50/80 border-gray-200 opacity-90'
                    : 'bg-white border-gray-100 opacity-60 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      fase.activa ? 'bg-teal-600 text-white' : fase.completada ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      FASE {fase.num}
                    </span>
                    <Icon size={14} className={fase.activa ? 'text-teal-600' : 'text-gray-400'} />
                  </div>
                  <h4 className="text-xs font-black text-gray-800 leading-tight mb-1">{fase.nombre}</h4>
                  <p className="text-[10px] text-gray-500 font-bold">{fase.sub}</p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[9px] font-black uppercase text-teal-600">
                  <span>{fase.activa ? '📍 En curso' : fase.completada ? '✅ Completada' : '⏳ Siguiente'}</span>
                  <Info size={11} className="text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>

        {faseInfoModal && (
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200/60 text-xs text-teal-900 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="space-y-1">
              <p className="font-black uppercase tracking-wider text-[11px] text-teal-800">
                💡 ¿Qué sucede en tu cuerpo durante la Fase {faseInfoModal.num} ({faseInfoModal.nombre})?
              </p>
              <p className="leading-relaxed">{faseInfoModal.explicacion}</p>
            </div>
            <button onClick={() => setFaseInfoModal(null)} className="text-teal-700 hover:text-teal-950 font-bold text-xs p-1">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 4. RECETA CONCIERGE: TUS CUIDADOS DE HOY & MICRO CHECK-IN POST-SESIÓN */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-teal-500/20 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
              <Stethoscope size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Receta Concierge: Tus Cuidados de Hoy</h3>
              <p className="text-[11px] text-teal-300/80">Indicaciones de tu especialista para maximizar los resultados de tu sesión</p>
            </div>
          </div>
          {ultimaSesionConcluida && (
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Última sesión: {new Date(ultimaSesionConcluida.fecha).toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {ultimaSesionConcluida?.notas ? (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-teal-100 leading-relaxed whitespace-pre-wrap">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-1 flex items-center gap-1.5">
              <Heart size={12} /> Indicaciones Médicas Personalizadas
            </p>
            {ultimaSesionConcluida.notas}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-300">
            <p className="leading-relaxed">💧 Mantén una hidratación constante de 2.5 L al día y realiza caminatas suaves de 20 minutos para activar el drenaje linfático de tu tratamiento.</p>
          </div>
        )}

        <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
              <Droplets size={14} className="text-cyan-400" /> Meta de Hidratación Diaria ({vasosAguaHoy * 250} ml / 2,500 ml)
            </span>
            <span className="text-xs font-bold text-gray-400">{vasosAguaHoy}/10 vasos</span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 pt-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const numVaso = i + 1;
              const lleno = vasosAguaHoy >= numVaso;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleToggleVasoAgua(numVaso)}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    lleno 
                      ? 'bg-gradient-to-t from-cyan-600 to-teal-400 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 scale-105' 
                      : 'bg-white/5 border-white/10 text-gray-500 hover:border-teal-400/50'
                  }`}
                  title={`Vaso #${numVaso} (250ml)`}
                >
                  <Droplets size={16} fill={lleno ? "currentColor" : "none"} />
                  <span className="text-[9px] font-black">{numVaso}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Heart size={14} className="text-rose-400" /> ¿Cómo te has sentido tras tu última sesión?
            </p>
            {checkinEnviado && (
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                ✓ Check-in Registrado
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => handleEnviarCheckin("excelente", "Me he sentido excelente")}
              disabled={enviandoCheckin}
              className={`p-3 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                checkinEnviado === "excelente"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                  : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10"
              }`}
            >
              🤩 Excelente, me siento genial
            </button>
            <button
              onClick={() => handleEnviarCheckin("bien", "Evolución normal")}
              disabled={enviandoCheckin}
              className={`p-3 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                checkinEnviado === "bien"
                  ? "bg-teal-600 text-white border-teal-500 shadow-md"
                  : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10"
              }`}
            >
              🙂 Bien, evolución normal
            </button>
            <button
              onClick={() => setMostrarModalDuda(true)}
              className="p-3 rounded-2xl border bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              🤔 Tengo una duda / molestia
            </button>
          </div>

          {mostrarModalDuda && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-3 animate-in fade-in">
              <p className="text-xs text-amber-200 font-bold">
                Escribe tu duda o molestia. Nuestro equipo médico y recepción se comunicarán contigo para resolverla de inmediato:
              </p>
              <textarea
                value={checkinNota}
                onChange={(e) => setCheckinNota(e.target.value)}
                placeholder="Ej. Siento ligero calor en la zona tratada o tengo dudas sobre mi alimentación de hoy..."
                className="w-full p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-white outline-none focus:ring-2 focus:ring-amber-400"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setMostrarModalDuda(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-gray-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleEnviarCheckin("duda", checkinNota)}
                  disabled={enviandoCheckin || !checkinNota.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {enviandoCheckin ? "Enviando..." : "Enviar a Recepción & Doctora"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
"""

with open("scripts/part_jsx.txt", "a", encoding="utf-8") as f:
    f.write(chunk2)
print("Chunk 2 appended.")
