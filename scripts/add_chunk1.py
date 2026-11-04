# -*- coding: utf-8 -*-
chunk1 = """
  return (
    <div className="space-y-6 pb-28 max-w-4xl mx-auto px-3 sm:px-6 animate-in fade-in duration-500">
      
      {/* 1. HERO HEADER CONCIERGE VIP ULTRA HD */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-teal-500/20">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Sparkles size={160} className="text-teal-400"/></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"/>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4 items-center">
            <div className="relative group cursor-pointer" onClick={() => { const inp = document.getElementById("global-foto-upload"); if(inp) inp.click(); }}>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-teal-400/30 shadow-2xl bg-slate-800 flex items-center justify-center shrink-0 ring-4 ring-teal-500/10">
                {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/> : <User size={36} className="text-teal-200/50"/>}
              </div>
              <button 
                className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full shadow-lg border-2 border-slate-900 hover:bg-emerald-400 transition-all z-20 hover:scale-110"
                title="Cambiar foto de perfil"
              >
                <Camera size={14} fill="currentColor" />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{perfilPaciente.nombre}</h1>
                {membresiaObj?.activa && (
                  <span className="text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Crown size={11} fill="currentColor"/> Socio Prime
                  </span>
                )}
              </div>
              <p className="text-teal-200/70 text-xs font-medium flex items-center gap-2">
                <span className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-lg border border-teal-500/30 font-bold">{perfilPaciente.tipoTratamiento}</span>
                <span>{perfilPaciente.telefono || 'Sin teléfono'}</span>
              </p>
              <div className="pt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Índice de Bienestar ALFRA: 94% · Excelente Respuesta
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => setAutoAgendadoOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Calendar size={15} /> Agendar Cita
            </button>
            <a
              href={`https://wa.me/5214494125867?text=${encodeURIComponent(`Hola Clínica ALFRA, soy ${perfilPaciente.nombre}. Me comunico desde mi perfil de paciente para una consulta.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
            >
              <MessageSquare size={15} className="text-emerald-400" /> Concierge
            </a>
          </div>
        </div>
      </div>

      <input 
        id="global-foto-upload" 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFotoUpload} 
      />

      {/* 2. MODO BIENVENIDA VIP EN CLÍNICA */}
      {citaHoy && (citaHoy.status === 'Confirmada' || citaHoy.status === 'En Cabina' || citaHoy.status === 'Pendiente Pase a Caja') && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-5 border-2 border-emerald-400/40 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Sparkles size={20} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span> MODO CLÍNICA EN VIVO
                </span>
                <span className="text-xs text-emerald-200/80 font-bold">{citaHoy.hora || 'Cita de Hoy'}</span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                {citaHoy.status === 'Confirmada' && `¡Bienvenida a ALFRA, ${perfilPaciente.nombre?.split(' ')[0]}!`}
                {citaHoy.status === 'En Cabina' && `Sesión en Cabina en Curso con ${citaHoy.especialistaNombre || 'tu especialista'}`}
                {citaHoy.status === 'Pendiente Pase a Caja' && `Sesión Concluida Exitosamente`}
              </h3>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                {citaHoy.status === 'Confirmada' && `Recepción ha confirmado tu llegada a sala de espera. Tu especialista ${citaHoy.especialistaNombre || ''} ya tiene preparada tu cabina para tu sesión de ${citaHoy.servicio || 'Tratamiento'}. Pasa a tomar asiento.`}
                {citaHoy.status === 'En Cabina' && `Estás en cabina para tu tratamiento de ${citaHoy.servicio || 'Tratamiento'}. Relájate, estamos cuidando cada detalle de tu salud.`}
                {citaHoy.status === 'Pendiente Pase a Caja' && `Tu tratamiento ha finalizado. Tus indicaciones de cuidado post-sesión ya están disponibles abajo.`}
              </p>
            </div>
          </div>
        </div>
      )}
"""

with open("scripts/part_jsx.txt", "a", encoding="utf-8") as f:
    f.write(chunk1)
print("Chunk 1 appended.")
