# -*- coding: utf-8 -*-
chunk3 = """
      {/* 5. TABS DE NAVEGACIÓN ULTRA HD */}
      <div className="flex flex-wrap gap-2 px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10 scale-105"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={14} className={isActive ? "text-turquesa" : "text-gray-400"} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB RESUMEN */}
      {activeTab === "progreso" && (
        <div className="space-y-5 animate-in fade-in">
          {proximaCita && (
            <Card className="shadow-lg border-l-4 border-l-turquesa p-5 bg-gradient-to-r from-teal-50/50 to-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-turquesa/10 rounded-2xl text-turquesa">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Próxima Cita Programada</span>
                    <h4 className="font-black text-base text-gray-800">{proximaCita.servicio || proximaCita.motivo || "Cita de Seguimiento"}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      📅 {proximaCita.fecha} · ⏰ {proximaCita.hora} · Con {proximaCita.especialistaNombre || 'Especialista asignada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                    proximaCita.status === "Confirmada" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {proximaCita.status || "Agendada"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card onClick={() => setActiveTab("miprogreso")} className="shadow-sm text-center py-4 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
              <Activity size={22} className="mx-auto text-turquesa mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-2xl font-black text-gray-800">{totalSesiones}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sesiones Totales</p>
            </Card>
            <Card onClick={() => setActiveTab("citas")} className="shadow-sm text-center py-4 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
              <Calendar size={22} className="mx-auto text-acero mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-2xl font-black text-gray-800">{citas.filter(c => c.status !== "Completada" && c.status !== "Cancelada").length}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Citas Pendientes</p>
            </Card>
            <Card onClick={() => setActiveTab("pagos")} className="shadow-sm text-center py-4 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
              <Receipt size={22} className="mx-auto text-purple-500 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-2xl font-black text-gray-800">{recibos.length}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recibos Emitidos</p>
            </Card>
            <Card onClick={() => setActiveTab("miprogreso")} className="shadow-sm text-center py-4 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
              <Stethoscope size={22} className="mx-auto text-cyan-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-2xl font-black text-gray-800 truncate px-1">{perfilPaciente.tipoTratamiento || "--"}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tratamiento Activo</p>
            </Card>
          </div>

          <Card className="relative overflow-hidden border border-teal-500/30 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 rounded-3xl shadow-lg group !p-0">
            <div className="p-6 sm:p-7 flex items-center gap-4 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Sparkle size={24} className="text-teal-200" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Inspiración Diaria ALFRA</p>
                <p className="text-sm sm:text-base font-medium text-white/95 leading-relaxed mt-0.5">"{getFraseDelDia()}"</p>
              </div>
            </div>
          </Card>

          {/* PLACEHOLDER_LEALTAD_BLOCK */}

          <Card className="shadow-sm border-turquesa/20">
            <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-turquesa" /> Plan de Cuidados en Casa Asignados
            </h3>
            {apoyoLoading ? (
              <p className="text-gray-400 text-sm">Cargando...</p>
            ) : apoyoCuidados.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-xl">El especialista no ha asignado cuidados en casa adicionales.</p>
            ) : (
              <div className="space-y-2">
                {apoyoCuidados.map((c, i) => {
                  const checked = !!apoyoCompletadoHoy[c.id];
                  return (
                    <button
                      key={c.id || i}
                      onClick={() => handleToggleCuidado(c.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        checked ? 'border-turquesa bg-turquesa/5' : 'border-gray-100 bg-white hover:border-turquesa/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          checked ? 'bg-turquesa border-turquesa text-white' : 'border-gray-300'
                        }`}>
                          {checked ? <CheckCircle size={14} /> : <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${checked ? 'text-turquesa line-through opacity-70' : 'text-gray-700'}`}>
                            {c.texto || c.categoria || c.tipo || "Cuidado"}
                          </p>
                          {c.instrucciones && <p className="text-[10px] text-gray-500 mt-0.5">{c.instrucciones}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {progresoData.length > 0 && (
            <Card className="shadow-sm">
              <h3 className="font-bold text-sm text-gray-700 mb-3">Evolución de Peso (kg)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progresoData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="peso" stroke="#20b2aa" strokeWidth={3} dot={{ r: 4, fill: "#20b2aa" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}
"""

with open("scripts/part_jsx.txt", "a", encoding="utf-8") as f:
    f.write(chunk3)
print("Chunk 3 appended.")
