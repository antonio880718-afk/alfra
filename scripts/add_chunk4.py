# -*- coding: utf-8 -*-
chunk4 = """
      {/* TAB MI PROGRESO */}
      {activeTab === "miprogreso" && (
        <div className="space-y-5 animate-in fade-in pb-8">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Tu Transformación en Clínica ALFRA</h2>
            <p className="text-xs text-gray-500 font-bold">Métricas clínicas, fotos de evolución y registro milimétrico</p>
          </div>

          {loadingTrat ? (
            <div className="py-16 flex items-center justify-center gap-3 text-gray-300">
              <RefreshCw className="animate-spin" size={24} />
              <span className="text-sm font-bold">Cargando tu historial...</span>
            </div>
          ) : tratamientos.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-100">
              <Activity size={48} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sin tratamientos registrados aún</p>
              <p className="text-gray-300 text-[10px] mt-1">La especialista creará tu expediente en la próxima sesión.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center mb-2">
                {tratamientos.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => setTratamientoActivo(tr)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border cursor-pointer ${
                      tratamientoActivo?.id === tr.id
                        ? "bg-slate-900 text-white border-transparent shadow-md scale-105"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {tr.tipo === "Corporal" ? "🌿" : "✨"} {tr.nombre}
                  </button>
                ))}
              </div>

              {tratamientoActivo && (() => {
                const sesiones = sesionesPorTrat[tratamientoActivo.id] || [];
                const isCorporal = tratamientoActivo.tipo === "Corporal";
                const chartData = sesiones
                  .map((s, i) => ({
                    sesion: "#" + (i + 1),
                    peso: parseFloat(s.medidas?.peso) || null,
                    cintura: parseFloat(s.medidas?.cintura) || null,
                    abdomen: parseFloat(s.medidas?.abdomen) || null,
                    cadera: parseFloat(s.medidas?.cadera) || null,
                    brazo: parseFloat(s.medidas?.brazo) || null,
                    pierna: parseFloat(s.medidas?.pierna) || null
                  }))
                  .filter((s) => s.peso || s.cintura || s.abdomen || s.cadera || s.brazo || s.pierna);

                const sesionesConFoto = sesiones.filter((s) => s.fotosSesion?.length > 0);
                const tieneFotosReales = sesionesConFoto.length >= 2;
                const primeraFoto = tieneFotosReales ? sesionesConFoto[0].fotosSesion[0].url : "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80";
                const ultimaFoto = tieneFotosReales ? sesionesConFoto[sesionesConFoto.length - 1].fotosSesion[0].url : "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80";

                return (
                  <div className="space-y-5">
                    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 rounded-3xl p-6 text-white border border-teal-500/20 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                          <Trophy size={14} className="text-amber-400" /> Transformación Medida al Milímetro
                        </span>
                        <span className="text-xs font-bold text-gray-400">{sesiones.length} sesiones auditadas</span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                        🎉 Has reducido <span className="text-teal-300">{equivalenciasProgreso.diffPeso} kg</span> y{" "}
                        <span className="text-teal-300">{equivalenciasProgreso.diffCintura} cm de contorno</span> desde tu primera consulta.
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Tallas de Ropa</p>
                          <p className="text-xl font-black text-white mt-1">-{equivalenciasProgreso.tallasAprox || 1} Talla(s)</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Ajuste holgado en tu guardarropa</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Grasa Localizada</p>
                          <p className="text-xl font-black text-white mt-1">~{equivalenciasProgreso.bloquesGrasa || 4} Bloques</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Equivalente a paquetes de 250g movilizados</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Racha de Constancia</p>
                          <p className="text-xl font-black text-white mt-1">{totalSesiones} Visitas</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Compromiso firme con tu salud</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <Sliders size={16} className="text-turquesa" />
                            Comparativa Visual Táctil (Antes vs Después)
                          </h4>
                          <p className="text-xs text-gray-500 font-medium">Desliza con tu dedo o ratón hacia los lados para comparar</p>
                        </div>
                        {!tieneFotosReales && (
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                            Modo Demostración
                          </span>
                        )}
                      </div>

                      <div className="max-w-xl mx-auto pt-2">
                        <BeforeAfterSlider
                          beforeUrl={primeraFoto}
                          afterUrl={ultimaFoto}
                          beforeLabel={tieneFotosReales ? "Día 1 (Inicial)" : "Inicial (Demo)"}
                          afterLabel={tieneFotosReales ? `Sesión #${sesiones.length} (Actual)` : "Actual (Demo)"}
                        />
                      </div>
                    </div>

                    {chartData.length > 0 && (
                      <Card className="shadow-lg p-5">
                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-3">Evolución de Medidas por Sesión</h4>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="sesion" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                              <Tooltip />
                              <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="#20b2aa" strokeWidth={3} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="cintura" name="Cintura (cm)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="abdomen" name="Abdomen (cm)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    )}

                    <div className="space-y-3 pt-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial Clínico de Sesiones</h4>
                      {sesiones.map((ses, idx) => (
                        <Card key={ses.id || idx} className="shadow-sm border-0 ring-1 ring-gray-100 p-4 relative overflow-hidden hover:shadow-md transition-all">
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${isCorporal ? "bg-teal-500" : "bg-purple-500"}`} />
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white px-2.5 py-1 rounded-md">
                              SESIÓN #{sesiones.length - idx}
                            </span>
                            <span className="text-xs font-bold text-gray-500">
                              {new Date(ses.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>

                          {ses.notas && (
                            <div className="mt-3 p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-gray-700 leading-relaxed">
                              <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider mb-1">Notas de la Especialista:</p>
                              {ses.notas}
                            </div>
                          )}

                          {ses.fotosSesion?.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                              {ses.fotosSesion.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  onClick={() => setZoomFotoUrl(f.url)}
                                  className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                                >
                                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
"""

with open("scripts/part_jsx.txt", "a", encoding="utf-8") as f:
    f.write(chunk4)
print("Chunk 4 appended.")
