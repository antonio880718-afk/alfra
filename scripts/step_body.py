# -*- coding: utf-8 -*-

comp_body = """
export default function PacienteProfile() {
  const { currentUser: authContextUser } = useAuth();
  const userAuth = authContextUser || auth.currentUser;
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("progreso");
  const [pacienteDocId, setPacienteDocId] = useState(null);
  const [perfilPaciente, setPerfilPaciente] = useState({ 
    nombre: "...cargando...", 
    telefono: "", 
    fechaNacimiento: "", 
    fotoUrl: null, 
    tipoTratamiento: "Mixto", 
    membresia: null, 
    sellosLealtad: 0, 
    recompensasDisponibles: 0, 
    primerSelloFecha: null, 
    fechaRegistro: null, 
    recompensaElegida: null, 
    lealtadActiva: true 
  });
  const [progresoData, setProgresoData] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [reciboVisualizar, setReciboVisualizar] = useState(null);
  const [citas, setCitas] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [apoyoCuidados, setApoyoCuidados] = useState([]);
  const [apoyoLoading, setApoyoLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [consumos, setConsumos] = useState([]);
  const [loadingConsumos, setLoadingConsumos] = useState(false);
  const [elegirRecompensa, setElegirRecompensa] = useState(false);
  const [chartMode, setChartMode] = useState('acumulado');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [guardandoEleccion, setGuardandoEleccion] = useState(false);
  const [beneficiosPorNivel, setBeneficiosPorNivel] = useState({});

  // Tratamientos v2
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientoActivo, setTratamientoActivo] = useState(null);
  const [sesionesPorTrat, setSesionesPorTrat] = useState({});
  const [loadingTrat, setLoadingTrat] = useState(true);

  // Estados exclusivos Concierge Ultra HD
  const [autoAgendadoOpen, setAutoAgendadoOpen] = useState(false);
  const [checkinEnviado, setCheckinEnviado] = useState(null);
  const [checkinNota, setCheckinNota] = useState('');
  const [enviandoCheckin, setEnviandoCheckin] = useState(false);
  const [mostrarModalDuda, setMostrarModalDuda] = useState(false);
  const [vasosAguaHoy, setVasosAguaHoy] = useState(0);
  const [zoomFotoUrl, setZoomFotoUrl] = useState(null);
  const [faseInfoModal, setFaseInfoModal] = useState(null);

  const handleFotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const localUrl = URL.createObjectURL(file);
      setPerfilPaciente(prev => ({...prev, fotoUrl: localUrl}));
      alert("¡Foto de perfil actualizada exitosamente!");
    } catch(err) {
      console.error(err);
      alert("Error al actualizar la foto.");
    }
  };

  // Nutrición & Ejercicio
  const [caloriasData, setCaloriasData] = useState([]);
  const [alimentosHoy, setAlimentosHoy] = useState([]);
  const [apoyoCompletadoHoy, setApoyoCompletadoHoy] = useState({});
  const [buscarAlimento, setBuscarAlimento] = useState("");

  const [isTracking, setIsTracking] = useState(false);
  const [trackTime, setTrackTime] = useState(0);
  const [trackDistance, setTrackDistance] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [lastPos, setLastPos] = useState(null);
  const [historialEjercicio, setHistorialEjercicio] = useState([]);

  useEffect(() => {
    let interval;
    if (isTracking) {
      interval = setInterval(() => { setTrackTime(t => t + 1); }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const loadHistorialEjercicio = async (pid) => {
    if (!pid) return;
    try {
        const trackers = await getDailyTrackers(pid, 30);
        const ejercicios = trackers
            .filter(t => t.tipo === "ejercicio")
            .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
            .map(t => ({
                id: t.id || Date.now(),
                fecha: new Date(t.fecha + "T00:00:00"),
                duracionSegundos: t.data?.duracionSegundos || 0,
                distanciaMetros: t.data?.distanciaMetros || 0
            }));
        setHistorialEjercicio(ejercicios);
    } catch(e) { console.log("Error cargando historial ejercicio:", e); }
  };

  const wakeLockRef = useRef(null);
  const startTracking = async () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta GPS");
    setIsTracking(true);
    setTrackTime(0);
    setTrackDistance(0);
    setLastPos(null);
    try {
        if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
    } catch(e) { console.log('Wake Lock no disponible:', e); }
    const id = navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 30) return;
        setLastPos(prev => {
            if (prev) {
                const R = 6371e3;
                const lat1 = prev.latitude * Math.PI/180;
                const lat2 = latitude * Math.PI/180;
                const deltaLat = (latitude - prev.latitude) * Math.PI/180;
                const deltaLon = (longitude - prev.longitude) * Math.PI/180;
                const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) *
                          Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const dist = R * c;
                if (dist > 1 && dist < 50) {
                    setTrackDistance(d => d + dist);
                }
            }
            return { latitude, longitude };
        });
    }, (err) => {
        console.error("GPS Error:", err);
    }, { enableHighAccuracy: true, maximumAge: 1000 });
    setWatchId(id);
  };

  const stopTracking = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    if (wakeLockRef.current) {
        try { await wakeLockRef.current.release(); } catch(e){}
        wakeLockRef.current = null;
    }
    setIsTracking(false);
    if (trackDistance > 10) {
        if (pacienteDocId) {
            try {
                await saveDailyTracker(pacienteDocId, "ejercicio", {
                    duracionSegundos: trackTime,
                    distanciaMetros: trackDistance,
                    caloriasQuemadas: Math.floor(trackDistance * 0.05),
                    hora: new Date().toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"})
                });
            } catch(e) { console.error("Error guardando ejercicio:", e); }
        }
        alert("¡Rutina de ejercicio guardada en tu expediente!");
        setTrackTime(0);
        setTrackDistance(0);
    }
  };
  
  const formatTime = (sec) => {
    const m = Math.floor(sec/60).toString().padStart(2, '0');
    const s = (sec%60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const META_CALORIAS = useMemo(() => {
    let meta = parseInt(perfilPaciente?.metaCalorica);
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      if (sesiones.length > 0) {
        const ultimaSesion = sesiones[sesiones.length - 1];
        if (ultimaSesion.metasPaciente?.metaCalorica) {
            meta = parseInt(ultimaSesion.metasPaciente.metaCalorica);
        }
      }
    }
    return meta || 1500;
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat]);

  const caloriasHoy = alimentosHoy.reduce((s,a) => s + a.calorias, 0);

  const caloriasDataTratamiento = useMemo(() => {
    if (!tratamientoActivo || (!tratamientoActivo.creadoEn && !tratamientoActivo.fechaInicio && !tratamientoActivo.createdAt)) return caloriasData;
    let fechaBase = tratamientoActivo.creadoEn || tratamientoActivo.fechaInicio || tratamientoActivo.createdAt;
    let inicioTrat = fechaBase.seconds ? new Date(fechaBase.seconds * 1000) : new Date(fechaBase);
    inicioTrat.setHours(0,0,0,0);
    const filtered = caloriasData.filter(d => {
        if (!d.fechaOriginal) return true;
        const tDate = new Date(d.fechaOriginal + 'T12:00:00');
        return tDate >= inicioTrat;
    });
    
    if (filtered.length === 0) {
        const today = new Date();
        const label = today.toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        return [{ fecha: label, calorias: 0, fechaOriginal: today.toISOString().split('T')[0] }];
    }
    return filtered;
  }, [caloriasData, tratamientoActivo]);

  // Flip card membresía
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!userAuth) return;
    let unsubCitas = null;
    const load = async () => {
      try {
        const paciente = await getPacienteByUid(userAuth.uid, userAuth.email);
        if (paciente) {
          setPacienteDocId(paciente.id);
          setPerfilPaciente({
            nombre: paciente.nombre || userAuth.displayName || userAuth.email?.split('@')[0] || "Paciente",
            telefono: paciente.telefono || paciente.phone || "",
            fechaNacimiento: paciente.fechaNacimiento || "",
            fotoUrl: paciente.fotoUrl || null,
            tipoTratamiento: paciente.tipoTratamiento || "Mixto",
            membresia: paciente.membresia || null,
            sellosLealtad: paciente.sellosLealtad || 0,
            recompensasDisponibles: paciente.recompensasDisponibles || 0,
            primerSelloFecha: paciente.primerSelloFecha || null,
            fechaRegistro: paciente.fechaRegistro || paciente.createdAt || null,
            recompensaElegida: paciente.recompensaElegida || null,
            lealtadActiva: paciente.lealtadActiva !== false,
            metaCalorica: paciente.metaCalorica || null
          });

          // 1. Seguimientos
          try {
            const seg = await getSeguimientosPaciente(paciente.id);
            setProgresoData((seg || []).slice(0,12).reverse().map(s=>({
              fecha: s.fechaRegistro ? new Date(s.fechaRegistro).toLocaleDateString("es-MX",{month:"short",day:"numeric"}) : "Hoy",
              peso: s.peso,
              imc: s.imc
            })));
          } catch(e) { console.warn("Aviso seguimientos:", e); }

          // 2. Recibos
          try {
            const rList = await getRecibosPaciente(paciente.id);
            setRecibos(rList || []);
          } catch(e) { console.warn("Aviso recibos:", e); }

          // 3. Citas en tiempo real
          try {
            unsubCitas = onCitasPacienteChange(paciente.id, (citasLive) => {
              setCitas(citasLive || []);
              setLoadingCitas(false);
            });
          } catch(e) {
            console.warn("Aviso citas listener:", e);
            setLoadingCitas(false);
          }

          // 4. Apoyo en casa
          try {
            const apoyo = await getApoyoEnCasa(paciente.id);
            setApoyoCuidados(apoyo || []);
            setApoyoLoading(false);
          } catch(e) {
            console.warn("Aviso apoyo en casa:", e);
            setApoyoLoading(false);
          }

          // 5. Tratamientos V2 y Sesiones
          try {
            const trList = await getTratamientosPaciente(paciente.id);
            setTratamientos(trList || []);
            if (trList?.length > 0) {
              setTratamientoActivo(trList[0]);
              const sesMap = {};
              for (const tr of trList) {
                const sList = await getSesionesPaciente(tr.id);
                sesMap[tr.id] = (sList || []).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
              }
              setSesionesPorTrat(sesMap);
            }
            setLoadingTrat(false);
          } catch(e) {
            console.warn("Aviso tratamientos v2:", e);
            setLoadingTrat(false);
          }

          // 6. Nutrición
          try {
            const trackers = await getDailyTrackers(paciente.id, 14);
            const calMap = {};
            trackers.filter(t => t.tipo === "alimentacion").forEach(t => {
                calMap[t.fecha] = t.data?.totalCalorias || 0;
            });
            const dList = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split("T")[0];
                const label = d.toLocaleDateString("es-MX",{month:"short",day:"numeric"});
                dList.push({ fecha: label, calorias: calMap[dStr] || 0, fechaOriginal: dStr });
            }
            setCaloriasData(dList);

            const todayStr = new Date().toISOString().split("T")[0];
            const todayTracker = trackers.find(t => t.tipo === "alimentacion" && t.fecha === todayStr);
            if (todayTracker?.data?.alimentos) setAlimentosHoy(todayTracker.data.alimentos);

            // Hidratación
            const aguaTracker = trackers.find(t => t.tipo === "hidratacion" && t.fecha === todayStr);
            if (aguaTracker?.data?.vasos) setVasosAguaHoy(aguaTracker.data.vasos);

            const apoyoTracker = trackers.find(t => t.tipo === "apoyo" && t.fecha === todayStr);
            if (apoyoTracker?.data) setApoyoCompletadoHoy(apoyoTracker.data);
          } catch(err) { console.warn("Aviso nutricion:", err); }

          // 7. Historial de ejercicio
          try {
            await loadHistorialEjercicio(paciente.id);
          } catch(e) { console.warn("Aviso ejercicio:", e); }

          // 8. Membresía consumos
          if (paciente.membresia?.activa) {
            setLoadingConsumos(true);
            try {
              const q = query(collection(db,"consumos_membresia"),where("pacienteId","==",paciente.id));
              const snap = await getDocs(q);
              setConsumos(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
                const da=a.fecha?.toDate?a.fecha.toDate():new Date(a.fecha||0);
                const db2=b.fecha?.toDate?b.fecha.toDate():new Date(b.fecha||0);
                return db2-da;
              }));
            } catch { setConsumos([]); }
            setLoadingConsumos(false);
          }

          try {
            const bSnap = await getDoc(doc(db,"configuracion","beneficios_membresia"));
            if (bSnap.exists()) setBeneficiosPorNivel(bSnap.data().beneficios||{});
          } catch {}
        } else {
          setPerfilPaciente(prev => ({
            ...prev,
            nombre: userAuth.displayName || userAuth.email?.split('@')[0] || "Paciente",
            telefono: userAuth.phoneNumber || "",
            tipoTratamiento: "Mixto"
          }));
          setLoadingCitas(false);
          setApoyoLoading(false);
          setLoadingTrat(false);
        }
      } catch(err) {
        console.error("Error cargando perfil de paciente:", err);
        setApoyoLoading(false);
        setLoadingCitas(false);
        setLoadingTrat(false);
      } finally {
        setLoadingData(false);
      }
    };
    load();
    return () => { if (unsubCitas) unsubCitas(); };
  }, [userAuth?.uid]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file||!pacienteDocId) return;
    try { 
      const { getStorage, ref, uploadBytes:ub, getDownloadURL:gdl } = await import("firebase/storage"); 
      const storage=getStorage(); 
      const sr=ref(storage,`pacientes/${pacienteDocId}/foto_perfil`); 
      await ub(sr,file); 
      const url=await gdl(sr); 
      await updateDoc(doc(db,"pacientes",pacienteDocId),{fotoUrl:url}); 
      setPerfilPaciente(p=>({...p,fotoUrl:url})); 
    } catch(err) { console.error(err); }
  };

  const handleSaveProfile = async () => { 
    if (!pacienteDocId) return; 
    try { 
      await updateDoc(doc(db,"pacientes",pacienteDocId),{nombre:perfilPaciente.nombre,fechaNacimiento:perfilPaciente.fechaNacimiento}); 
      alert("Perfil guardado."); 
    } catch(err) { console.error(err); } 
  };

  const handleResetEmail = async () => { 
    if (!auth.currentUser?.email) return; 
    setSendingReset(true); 
    try { 
      await sendPasswordResetEmail(auth,auth.currentUser.email); 
      setResetSent(true); 
    } catch(err){console.error(err);} 
    setSendingReset(false); 
  };

  const handleElegirRecompensa = async (op) => { 
    if (!pacienteDocId||guardandoEleccion) return; 
    setGuardandoEleccion(true); 
    try { 
      await updateDoc(doc(db,"pacientes",pacienteDocId),{recompensaElegida:op,recompensasDisponibles:0}); 
      setPerfilPaciente(p=>({...p,recompensaElegida:op,recompensasDisponibles:0})); 
      setElegirRecompensa(false); 
    } catch(err){console.error(err);} 
    setGuardandoEleccion(false); 
  };

  const handleToggleCuidado = async (cuidadoId) => { 
    if (!pacienteDocId) return; 
    const newVal = !apoyoCompletadoHoy[cuidadoId]; 
    const newData = { ...apoyoCompletadoHoy, [cuidadoId]: newVal }; 
    setApoyoCompletadoHoy(newData); 
    try { await saveDailyTracker(pacienteDocId, "apoyo", newData); } catch (err) { console.error(err); } 
  };

  // Hidratación interactiva por vasos (Meta: 10 vasos = 2.5 Litros)
  const handleToggleVasoAgua = async (indexVaso) => {
    if (!pacienteDocId) return;
    const nuevoTotal = vasosAguaHoy === indexVaso ? indexVaso - 1 : indexVaso;
    const finalVal = Math.max(0, Math.min(10, nuevoTotal));
    setVasosAguaHoy(finalVal);
    try {
      await saveDailyTracker(pacienteDocId, "hidratacion", {
        vasos: finalVal,
        mililitros: finalVal * 250,
        fecha: new Date().toISOString()
      });
    } catch(e) { console.error("Error guardando agua:", e); }
  };

  // Micro Check-in Post-Sesión Concierge (Conectado con Recepción y Especialista)
  const handleEnviarCheckin = async (estado, notaCustom) => {
    if (!pacienteDocId) return;
    setEnviandoCheckin(true);
    try {
      const citaReciente = citas.find(c => c.status === "Completada" || c.status === "Pendiente Pase a Caja") || citas[0] || {};
      const payloadCheckin = {
        pacienteId: pacienteDocId,
        pacienteNombre: perfilPaciente.nombre || "Paciente ALFRA",
        pacienteTelefono: perfilPaciente.telefono || "",
        estado,
        nota: notaCustom || checkinNota || "",
        fecha: new Date().toISOString(),
        atendido: false,
        especialistaNombre: citaReciente?.especialistaNombre || "Clínica ALFRA",
        servicio: citaReciente?.servicio || "Tratamiento"
      };

      await addDoc(collection(db, "seguimiento_post_consulta"), payloadCheckin);
      await updateDoc(doc(db, "pacientes", pacienteDocId), {
        ultimoCheckinPostConsulta: payloadCheckin
      });

      setCheckinEnviado(estado);
      setMostrarModalDuda(false);
      setCheckinNota("");
    } catch(err) {
      console.error("Error guardando checkin post-consulta:", err);
    } finally {
      setEnviandoCheckin(false);
    }
  };

  const updateCantidad = async (index, delta) => {
    if (!pacienteDocId) return;
    let newList = [...alimentosHoy];
    let item = newList[index];
    let currentQty = item.cantidad || 1;
    let unitCal = item.calorias / currentQty;
    let newQty = currentQty + delta;
    
    if (newQty <= 0) {
        newList.splice(index, 1);
    } else {
        newList[index] = { ...item, cantidad: newQty, calorias: unitCal * newQty };
    }
    
    setAlimentosHoy(newList);
    try {
        const total = newList.reduce((s,a) => s+a.calorias, 0);
        await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
        const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        setCaloriasData(prev => { 
          const exists = prev.find(p => p.fecha === todayLabel); 
          return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; 
        });
    } catch(err) { console.error(err); }
  };

  const handleAddAlimento = async (alimento, qty = 1) => {
    const isExisting = alimentosHoy.findIndex(x => x.nombre === alimento.nombre && x.porcion === alimento.porcion);
    let newList;
    if (isExisting >= 0) {
        const existing = alimentosHoy[isExisting];
        const currentQty = existing.cantidad || 1;
        const unitCal = existing.calorias / currentQty;
        newList = [...alimentosHoy];
        newList[isExisting] = { ...existing, cantidad: currentQty + qty, calorias: existing.calorias + (unitCal * qty), timestamp: new Date() };
        const [moved] = newList.splice(isExisting, 1);
        newList.unshift(moved);
    } else {
        newList = [{...alimento, cantidad: qty, calorias: alimento.calorias * qty, id:Date.now(), timestamp:new Date()}, ...alimentosHoy];
    }
    setAlimentosHoy(newList); setBuscarAlimento("");
    if (pacienteDocId) {
      try { 
        const total = newList.reduce((s,a) => s+a.calorias, 0); 
        await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
        const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        setCaloriasData(prev => { 
          const exists = prev.find(p => p.fecha === todayLabel); 
          return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; 
        });
      } catch(err) { console.error(err); }
    }
  };

  const membresiaObj = getMembresiaObj(perfilPaciente.membresia);
  const tabs = [ 
    {key:"progreso", label:"Resumen", icon: Activity},
    {key:"miprogreso", label:"Progreso", icon: Sparkles},
    {key:"citas", label:"Citas", icon: Calendar},
    {key:"expediente", label:"Estilo de Vida", icon: Flame},
    {key:"pagos", label:"Pagos", icon: Receipt}, 
    ...(membresiaObj?.activa ? [{key:"membresia", label:"Membresía", icon: Crown}] : []), 
    {key:"config", label:"Config", icon: User} 
  ];

  let searchQty = 1;
  let searchQuery = buscarAlimento.toLowerCase().trim();
  const qtyMatch = searchQuery.match(/^(\d+)\s*(.*)/);
  if (qtyMatch) {
      searchQty = parseInt(qtyMatch[1]) || 1;
      searchQuery = qtyMatch[2].trim();
  }
  const alimentosFiltrados = searchQuery.length > 0 ? ALIMENTOS_CATALOGO.filter(a => a.nombre.toLowerCase().includes(searchQuery)) : [];

  const getFraseDelDia = () => {
    const frases = [
      "El autocuidado no es un lujo, es una inversión directa en tu calidad de vida.",
      "Cada paso que das hoy es un ladrillo en la construcción de tu bienestar futuro.",
      "Tu cuerpo es el único lugar en el que vas a vivir toda tu vida, trátalo con amor.",
      "La salud no lo es todo, pero sin ella, todo lo demás es nada.",
      "Pequeños progresos diarios suman grandes resultados a largo plazo.",
      "El descanso productivo es tan importante como el trabajo duro.",
      "No cuentes los días, haz que los días cuenten para tu salud.",
      "Tu mente siempre cree lo que le dices, háblale de salud y energía.",
      "El cuerpo logra lo que la mente cree.",
      "Invertir en ti mismo es la mejor decisión que harás en tu vida."
    ];
    const diaDelMes = new Date().getDate() || 1;
    return frases[diaDelMes % frases.length] || frases[0];
  };

  // Cálculos en tiempo real de la transformación y modo clínica
  const totalSesiones = useMemo(() => {
    return Object.values(sesionesPorTrat).reduce((acc, arr) => acc + arr.length, 0);
  }, [sesionesPorTrat]);

  const citaHoy = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return citas.find(c => {
      const fc = c.fecha || (c.fechaHora ? c.fechaHora.split("T")[0] : "");
      return fc === todayStr && c.status !== "Cancelada";
    });
  }, [citas]);

  const proximaCita = useMemo(() => {
    return citas
      .filter(c => c.status !== "Completada" && c.status !== "Cancelada")
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))[0] || null;
  }, [citas]);

  const ultimaSesionConcluida = useMemo(() => {
    const all = [];
    Object.values(sesionesPorTrat).forEach(arr => all.push(...arr));
    return all.sort((a,b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
  }, [sesionesPorTrat]);

  // Roadmap de 4 fases clínicas
  const roadmapFases = useMemo(() => {
    let fActual = 1;
    if (totalSesiones >= 9) fActual = 4;
    else if (totalSesiones >= 6) fActual = 3;
    else if (totalSesiones >= 3) fActual = 2;
    else fActual = 1;

    return [
      {
        num: 1,
        nombre: "Preparación & Desintoxicación",
        sub: "Sesiones 1 a 2",
        icono: Sparkles,
        explicacion: "Activamos tu sistema circulatorio y linfático. El tejido se descongestiona y se prepara para recibir la aparatología y nutrientes.",
        completada: totalSesiones >= 3,
        activa: fActual === 1
      },
      {
        num: 2,
        nombre: "Activación & Reducción Profunda",
        sub: "Sesiones 3 a 5",
        icono: Flame,
        explicacion: "Fase de máxima quema y movilización de grasa localizada. Notarás ligereza corporal y descenso acelerado de centímetros.",
        completada: totalSesiones >= 6,
        activa: fActual === 2
      },
      {
        num: 3,
        nombre: "Moldeo, Definición & Ajuste",
        sub: "Sesiones 6 a 8",
        icono: Target,
        explicacion: "Reafirmación de fibras de colágeno y elastina. Compactación de tejidos y perfilado de silueta para resultados estéticos notables.",
        completada: totalSesiones >= 9,
        activa: fActual === 3
      },
      {
        num: 4,
        nombre: "Consolidación & Mantenimiento VIP",
        sub: "Sesión 9+",
        icono: Trophy,
        explicacion: "Blindaje de resultados. Tu metabolismo basal se estabiliza para asegurar que el cambio permanezca en el tiempo.",
        completada: totalSesiones >= 12,
        activa: fActual === 4
      }
    ];
  }, [totalSesiones]);

  const progresoGlobalPct = Math.min(100, Math.max(15, Math.round((totalSesiones / 10) * 100)));

  // Cálculos de equivalencias humanas
  const equivalenciasProgreso = useMemo(() => {
    let diffPeso = 0;
    let diffCintura = 0;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length >= 2) {
      const sArr = sesionesPorTrat[tratamientoActivo.id];
      const p1 = parseFloat(sArr[0]?.medidas?.peso) || 0;
      const pU = parseFloat(sArr[sArr.length - 1]?.medidas?.peso) || 0;
      if (p1 && pU) diffPeso = (p1 - pU).toFixed(1);

      const c1 = parseFloat(sArr[0]?.medidas?.cintura) || 0;
      const cU = parseFloat(sArr[sArr.length - 1]?.medidas?.cintura) || 0;
      if (c1 && cU) diffCintura = (c1 - cU).toFixed(1);
    }
    const tallasAprox = Math.max(0, Math.round(Number(diffCintura) / 3.5));
    const bloquesGrasa = Math.max(0, Math.round(Number(diffPeso) * 4)); // Bloques de 250g

    return {
      diffPeso: Number(diffPeso),
      diffCintura: Number(diffCintura),
      tallasAprox,
      bloquesGrasa
    };
  }, [tratamientoActivo, sesionesPorTrat]);
"""

with open("scripts/part_comp_body.txt", "w", encoding="utf-8") as f:
    f.write(comp_body)

print("Component body part written successfully!")
