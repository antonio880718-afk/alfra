# -*- coding: utf-8 -*-
chunk5 = """
      {/* TAB CITAS */}
      {activeTab === "citas" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-base font-black text-gray-800 uppercase tracking-wider">Tus Citas en ALFRA</h3>
            <button
              onClick={() => setAutoAgendadoOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-turquesa hover:text-slate-950 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar size={14} /> Nueva Cita
            </button>
          </div>

          {loadingCitas ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando citas...</p>
          ) : citas.length === 0 ? (
            <Card className="text-center py-12">
              <Calendar size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 font-bold text-sm">Sin citas programadas</p>
              <button
                onClick={() => setAutoAgendadoOpen(true)}
                className="mt-3 px-4 py-2 bg-turquesa text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Agendar mi primera cita
              </button>
            </Card>
          ) : (
            citas.map((c, i) => (
              <Card key={i} className="shadow-sm hover:shadow-md transition-all p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">{c.servicio || c.motivo || "Cita de Seguimiento"}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">📅 {c.fecha} · ⏰ {c.hora} · {c.especialistaNombre || 'Clínica ALFRA'}</p>
                  </div>
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                    c.status === "Confirmada" ? "bg-emerald-100 text-emerald-800" : c.status === "Completada" ? "bg-teal-100 text-teal-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {c.status || "Pendiente"}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB ESTILO DE VIDA (TRACKER GPS + NUTRICIÓN) */}
      {activeTab === "expediente" && (
        <div className="space-y-5 animate-in fade-in pb-10">
          <Card className="shadow-xl border-0 ring-1 ring-turquesa/20 bg-gradient-to-b from-turquesa/5 to-white relative overflow-hidden">
            <div className="p-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-turquesa/10 flex items-center justify-center mb-2">
                <Footprints size={24} className="text-turquesa" />
              </div>
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight text-center">Rastreador GPS Deportivo</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mb-4">50% Clínica · 50% Tu Compromiso en Casa</p>
              
              <div className="w-full bg-gray-900 rounded-3xl p-6 text-center shadow-inner relative overflow-hidden mb-4">
                <div className="absolute top-0 right-0 p-4 opacity-5"><MapPin size={100} className="text-white"/></div>
                <div className="relative z-10 flex justify-center items-end gap-2 mb-2">
                  <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{formatTime(trackTime)}</span>
                </div>
                <div className="relative z-10 flex justify-around mt-4 border-t border-gray-700/50 pt-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Distancia</p>
                    <p className="text-xl font-bold text-turquesa">{(trackDistance / 1000).toFixed(2)} <span className="text-xs">km</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Calorías Estimadas</p>
                    <p className="text-xl font-bold text-orange-400">{Math.floor(trackDistance * 0.05)} <span className="text-xs">kcal</span></p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                {!isTracking ? (
                  <button onClick={startTracking} className="flex-1 bg-turquesa text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-turquesa/90 transition-all flex justify-center items-center gap-2 shadow-md cursor-pointer">
                    <Play fill="currentColor" size={16}/> Iniciar Caminata / Trote
                  </button>
                ) : (
                  <button onClick={stopTracking} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all flex justify-center items-center gap-2 shadow-md animate-pulse cursor-pointer">
                    <Square fill="currentColor" size={16}/> Terminar Rutina
                  </button>
                )}
              </div>
            </div>
            
            {historialEjercicio.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">Tus últimas rutas registradas</p>
                <div className="space-y-2">
                  {historialEjercicio.map(rec => (
                    <div key={rec.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-turquesa/10 rounded-lg"><Navigation size={14} className="text-turquesa"/></div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">Caminata al aire libre</p>
                          <p className="text-[10px] text-gray-400">{new Date(rec.fecha).toLocaleDateString()} · {formatTime(rec.duracionSegundos)} min</p>
                        </div>
                      </div>
                      <span className="font-black text-turquesa">{(rec.distanciaMetros / 1000).toFixed(2)} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-1">Diario de Alimentación</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Registra lo que consumes hoy</p>
            <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Ingesta Calórica</span>
                <div className="flex items-end gap-2 text-gray-800">
                  <span className="text-3xl font-black leading-none">{caloriasHoy}</span>
                  <span className="text-sm font-bold opacity-60">/ {META_CALORIAS} kcal</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-full border-4 border-turquesa/20 flex items-center justify-center font-black text-xs text-turquesa" style={{ borderTopColor: "#20b2aa" }}>
                {Math.min(100, Math.round(caloriasHoy / META_CALORIAS * 100))}%
              </div>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-turquesa outline-none shadow-sm"
                placeholder="Busca alimentos rápidos (Ej. Manzana, Pollo, Ensalada)..."
                value={buscarAlimento}
                onChange={e => setBuscarAlimento(e.target.value)}
              />
              {buscarAlimento.length > 0 && alimentosFiltrados.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 mt-2 max-h-48 overflow-y-auto">
                  {alimentosFiltrados.map(a => (
                    <div 
                      key={a.id} 
                      className="p-3 border-b border-gray-50 hover:bg-turquesa/5 flex justify-between items-center cursor-pointer" 
                      onClick={() => handleAddAlimento(a, searchQty)}
                    >
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{searchQty > 1 ? `${searchQty}x ` : ''}{a.nombre}</span>
                        <span className="text-[10px] text-gray-400 font-bold block">{a.porcion}</span>
                      </div>
                      <span className="font-black text-turquesa text-sm">+{a.calorias * searchQty} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {alimentosHoy.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No has registrado alimentos hoy</p>
                </div>
              ) : (
                alimentosHoy.map((a, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div>
                      <span className="font-bold text-gray-800 text-sm">{a.nombre}</span>
                      <span className="text-[10px] text-gray-400 block mb-1">
                        {a.porcion} · {new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, -1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 cursor-pointer">-</button>
                        <span className="text-xs font-black text-gray-700 w-4 text-center">{a.cantidad || 1}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, 1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 cursor-pointer">+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-turquesa text-lg">+{a.calorias}</span>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">kcal</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB PAGOS */}
      {activeTab === "pagos" && (
        <div className="space-y-3 animate-in fade-in">
          <h3 className="text-base font-black text-gray-800 uppercase tracking-wider mb-2">Tus Recibos Digitales Oficiales</h3>
          {recibos.length === 0 ? (
            <Card className="text-center py-12">
              <Receipt size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">Sin recibos registrados en tu cuenta</p>
            </Card>
          ) : (
            recibos.map((r, i) => (
              <Card key={i} onClick={() => setReciboVisualizar(r)} className="shadow-sm cursor-pointer hover:shadow-md hover:border-turquesa/50 transition-all active:scale-95 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{r.concepto || r.servicio || "Pago en Clínica"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.fecha ? new Date(r.fecha.seconds ? r.fecha.seconds * 1000 : r.fecha).toLocaleDateString("es-MX") : "--"}
                    </p>
                  </div>
                  <span className="font-black text-turquesa text-base">
                    ${Number(r.total || r.monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-3 flex items-center gap-1">
                  <FileText size={10} className="text-turquesa" /> Toca para ver recibo con firma digital
                </p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL RECIBO DIGITAL */}
      {reciboVisualizar && (
        <ReciboDigital 
          isOpen={!!reciboVisualizar} 
          onClose={() => setReciboVisualizar(null)} 
          datosRecibo={{
            folio: reciboVisualizar.id || 'N/A',
            fecha: reciboVisualizar.fecha ? new Date(reciboVisualizar.fecha.seconds ? reciboVisualizar.fecha.seconds * 1000 : reciboVisualizar.fecha).toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString(),
            pacienteNombre: perfilPaciente.nombre || 'Paciente',
            concepto: reciboVisualizar.concepto || reciboVisualizar.servicio || "Pago en Clínica",
            monto: Number(reciboVisualizar.total || reciboVisualizar.monto || 0),
            metodoPago: reciboVisualizar.metodoPago || "Efectivo",
            atiende: reciboVisualizar.atiende || "Clínica Alfra",
            sucursal: "Matriz"
          }}
        />
      )}

      {/* PLACEHOLDER_MEMBRESIA_BLOCK */}

      {/* TAB CONFIG */}
      {activeTab === "config" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-sm">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-turquesa/30 shadow-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Camera size={24} className="text-gray-400"/></div>}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-turquesa font-bold cursor-pointer">Cambiar foto de perfil</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre Completo</label>
                <input type="text" value={perfilPaciente.nombre} onChange={e => setPerfilPaciente(p => ({ ...p, nombre: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha de Nacimiento</label>
                <input type="date" value={perfilPaciente.fechaNacimiento} onChange={e => setPerfilPaciente(p => ({ ...p, fechaNacimiento: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none" />
              </div>
              <Button variant="primary" fullWidth onClick={handleSaveProfile}>Guardar Cambios</Button>
            </div>
          </Card>
          <Card className="shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2"><Lock size={16}/> Seguridad de tu Cuenta</h3>
            <p className="text-xs text-gray-500 mb-3">Recibe un correo seguro para restablecer o cambiar tu contraseña.</p>
            {resetSent ? (
              <p className="text-xs text-emerald-600 font-bold">✓ Correo enviado con éxito. Revisa tu bandeja de entrada.</p>
            ) : (
              <Button variant="outline" fullWidth onClick={handleResetEmail} disabled={sendingReset}>
                {sendingReset ? "Enviando..." : "Restablecer Contraseña por Correo"}
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* MODAL AUTO-AGENDADO INTELIGENTE */}
      <AutoAgendadoModal
        isOpen={autoAgendadoOpen}
        onClose={() => setAutoAgendadoOpen(false)}
        paciente={perfilPaciente}
        onAgendado={() => {
          setAutoAgendadoOpen(false);
          alert("¡Tu cita ha sido agendada con éxito! Aparece ya en tu listado.");
        }}
      />

      {/* MODAL ZOOM DE FOTO DE EVOLUCIÓN */}
      {zoomFotoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setZoomFotoUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img src={zoomFotoUrl} alt="Foto Ampliada" className="rounded-2xl max-w-full max-h-[85vh] object-contain shadow-2xl border border-white/20" />
            <button
              onClick={() => setZoomFotoUrl(null)}
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
"""

with open("scripts/part_jsx.txt", "a", encoding="utf-8") as f:
    f.write(chunk5)
print("Chunk 5 appended.")
