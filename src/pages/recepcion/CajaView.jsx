import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    DollarSign, Search, PlusCircle, CreditCard, Banknote, Bell, Gift, Sparkles, Heart, Calendar, MessageSquare,
    CheckCircle, Loader, ArrowRightLeft, Trash2, TrendingDown, Wallet,
    Calculator, AlertTriangle, FileText, Tag, ShieldCheck, Layers, ArrowDownCircle
} from 'lucide-react';
import ReciboDigital from '../../components/ui/ReciboDigital';
import { obtenerProximosCumpleanos } from '../../utils/cumpleanosUtils';
import ModalTarjetaCumpleanos from '../../components/cumpleanos/ModalTarjetaCumpleanos';
import {
    registrarMovimiento,
    onMovimientosChange,
    solicitarCancelacionMovimiento,
    toLocalISOString,
    CATALOGO_CATEGORIAS_GASTO,
    ORIGENES_PAGO_GASTO,
    DENOMINACIONES_ARQUEO,
    obtenerCatalogoGastosCompleto,
    agregarMotivoPersonalizadoGasto,
    normalizarCategoriaGasto,
    esGastoDeCajaDelDia,
    onCajasDiariasChange,
    guardarCajaDiaria,
} from '../../services/finanzasService';
import { createRecibo } from '../../services/recibosService';
import { getPacientes, getPacienteById, updatePaciente } from '../../services/pacientesService';
import { onInventarioChange, updateInventarioItem } from '../../services/inventarioService';
import { getStaff, asignarComision } from '../../services/staffService';
import { onPlanesChange, updatePlan } from '../../services/planesService';
import { abrirWhatsApp } from '../../services/whatsappService';
import { onServiciosChange } from '../../services/comercialService';
import { onCitasChange, updateCitaStatus } from '../../services/citasService';
import { useAuth } from '../../contexts/AuthContext';

const formatMoney = (n) =>
    `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CajaView() {
    const [monto, setMonto] = useState('');
    const [motivo, setMotivo] = useState('');
    const [pacienteNombre, setPacienteNombre] = useState('');
    const [pacienteId, setPacienteId] = useState(null);
    const [pacienteTelefono, setPacienteTelefono] = useState('');
    const [pacienteSeleccionadoData, setPacienteSeleccionadoData] = useState(null);
    const [paqueteInfo, setPaqueteInfo] = useState('');
    const [saving, setSaving] = useState(false);
    const [listaItems, setListaItems] = useState([]);

    // Autenticación
    const { userRole, currentUser } = useAuth();

    // Fecha de Operación
    const hoyEstandar = toLocalISOString().split('T')[0];
    const [fechaOperacion, setFechaOperacion] = useState(hoyEstandar);

    // Búsqueda de Productos (Inventario)
    const [inventario, setInventario] = useState([]);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [mostrarSugerenciasProducto, setMostrarSugerenciasProducto] = useState(false);

    // Búsqueda de Servicios (Catálogo)
    const [serviciosCat, setServiciosCat] = useState([]);
    const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

    // Selección de Staff (Comisiones)
    const [staffList, setStaffList] = useState([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');

    // Búsqueda de pacientes
    const [busquedaPaciente, setBusquedaPaciente] = useState('');
    const [pacientesLista, setPacientesLista] = useState([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

    // Abono a Planes
    const [pacienteAbono, setPacienteAbono] = useState('');
    const [montoAbono, setMontoAbono] = useState('');
    const [savingAbono, setSavingAbono] = useState(false);
    const [planesList, setPlanesList] = useState([]);
    const [planSeleccionadoAbono, setPlanSeleccionadoAbono] = useState(null);
    const [mostrarSugerenciasPlan, setMostrarSugerenciasPlan] = useState(false);

    // Todos los movimientos y Cajas Diarias en tiempo real
    const [todosMovimientos, setTodosMovimientos] = useState([]);
    const [cajasMap, setCajasMap] = useState({});
    const [citasList, setCitasList] = useState([]);

    // Catálogo unificado y ampliado de Categorías y Motivos de Gasto
    const [catalogoGastos, setCatalogoGastos] = useState(CATALOGO_CATEGORIAS_GASTO);
    const [categoriaGasto, setCategoriaGasto] = useState(CATALOGO_CATEGORIAS_GASTO[0].nombre);
    const [motivoGastoCatalogo, setMotivoGastoCatalogo] = useState(CATALOGO_CATEGORIAS_GASTO[0].motivos[0]);
    const [detalleGastoExtra, setDetalleGastoExtra] = useState('');
    const [montoGasto, setMontoGasto] = useState('');
    const [origenGasto, setOrigenGasto] = useState('Efectivo en Caja');
    const [proveedorGasto, setProveedorGasto] = useState('');
    const [folioNotaGasto, setFolioNotaGasto] = useState('');
    const [savingGasto, setSavingGasto] = useState(false);
    const [nuevoMotivoPersonalizado, setNuevoMotivoPersonalizado] = useState('');
    const [mostrarInputNuevoMotivo, setMostrarInputNuevoMotivo] = useState(false);

    // Modal Pago Mixto (Dividido)
    const [modalMixtoOpen, setModalMixtoOpen] = useState(false);
    const [mixtoContext, setMixtoContext] = useState('servicio'); // 'servicio' | 'abono'
    const [mixtoEfectivo, setMixtoEfectivo] = useState('');
    const [mixtoTarjeta, setMixtoTarjeta] = useState('');
    const [mixtoTransferencia, setMixtoTransferencia] = useState('');

    // Modal Fondo Inicial y Retiros Parciales de Caja
    const [modalFondoOpen, setModalFondoOpen] = useState(false);
    const [fondoInicialInput, setFondoInicialInput] = useState('');
    const [retiroMonto, setRetiroMonto] = useState('');
    const [retiroConcepto, setRetiroConcepto] = useState('');
    const [retiroRecibe, setRetiroRecibe] = useState('Administración');
    const [savingCajaConfig, setSavingCajaConfig] = useState(false);

    // Modal Arqueo Físico de Caja (Billetes y Monedas) y Entrega de Corte
    const [modalArqueoOpen, setModalArqueoOpen] = useState(false);
    const [conteoDenominaciones, setConteoDenominaciones] = useState({});
    const [entregadoPorNombre, setEntregadoPorNombre] = useState('');
    const [notasRecepcionCorte, setNotasRecepcionCorte] = useState('');
    const [savingArqueo, setSavingArqueo] = useState(false);

    // Estado para el Recibo
    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [datosReciboActual, setDatosReciboActual] = useState(null);

    // Alertas cumpleaños
    const [cumpleanosPacientes, setCumpleanosPacientes] = useState([]);
    const [pacienteTarjetaModal, setPacienteTarjetaModal] = useState(null);

    // Modal de Cancelación
    const [modalCancelacionOpen, setModalCancelacionOpen] = useState(false);
    const [cancelacionId, setCancelacionId] = useState(null);
    const [motivoCancelacion, setMotivoCancelacion] = useState('');

    // Modal de Recompensa (Lealtad)
    const [modalRecompensaOpen, setModalRecompensaOpen] = useState(false);
    const [recompensaDetalle, setRecompensaDetalle] = useState('');

    // Filtro de movimientos del día (Todos / Ingresos / Egresos)
        const [filtroMovsDia, setFiltroMovsDia] = useState('Todos');

    // Sub-pestaña de alertas en caja (checkin / citas / cumples)
    const [subTabAlertas, setSubTabAlertas] = useState('checkin');
    const [alertasCheckinPost, setAlertasCheckinPost] = useState([]);
    const [alertasCitasApp, setAlertasCitasApp] = useState([]);

    // Escuchar alertas de check-in post consulta y citas app en tiempo real
    useEffect(() => {
        let unsubCheckin = () => {};
        let unsubCitas = () => {};
        import('firebase/firestore').then(({ collection, query, orderBy, limit, onSnapshot }) => {
            import('../../lib/firebase').then(({ db }) => {
                const qCheckin = query(collection(db, 'seguimiento_post_consulta'), orderBy('fecha', 'desc'), limit(30));
                unsubCheckin = onSnapshot(qCheckin, (snap) => {
                    setAlertasCheckinPost(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.warn('Aviso seguimiento_post_consulta:', err));

                const qCitas = query(collection(db, 'alertas_recepcion'), orderBy('creadoEn', 'desc'), limit(30));
                unsubCitas = onSnapshot(qCitas, (snap) => {
                    setAlertasCitasApp(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (err) => console.warn('Aviso alertas_recepcion:', err));
            });
        });
        return () => {
            unsubCheckin();
            unsubCitas();
        };
    }, []);

    const handleMarcarAlertaAtendida = async (id, col = 'seguimiento_post_consulta') => {
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../lib/firebase');
            await updateDoc(doc(db, col, id), { atendido: true });
        } catch (e) {
            console.error('Error marcando alerta atendida:', e);
        }
    };

    const enviarWhatsAppMotivador = (alerta) => {
        const tel = String(alerta?.pacienteTelefono || '').replace(/\D/g, '');
        if (!tel) {
            alert('Este paciente no tiene registrado su número de teléfono.');
            return;
        }
        const nombre = (alerta?.pacienteNombre || 'Paciente').split(' ')[0];
        let mensaje = '';
        if (alerta.estado === 'excelente') {
            mensaje = `¡Hola ${nombre}! ✨ En Clínica ALFRA nos alegra muchísimo saber que te sentiste excelente tras tu sesión. Recuerda que la constancia y la disciplina son la clave para que alcances tus mejores resultados. ¡Sigue así, estamos muy orgullosas de tu avance! 💖`;
        } else if (alerta.estado === 'bien') {
            mensaje = `¡Hola ${nombre}! 🌸 Nos alegra saber que tu evolución va normal y en orden. Mantén una buena hidratación y sigue cuidando tus hábitos para potenciar los resultados de tu tratamiento. ¡La disciplina hace la magia! ✨`;
        } else {
            mensaje = `¡Hola ${nombre}! 🌸 Recibimos tu comentario en tu App de ALFRA: "${alerta.nota || ''}". Con mucho gusto estamos aquí para resolver cualquier duda y asegurarnos de que estés cómoda y segura en cada paso. Cuéntanos, ¿en qué podemos apoyarte? 💕`;
        }
        abrirWhatsApp(tel, mensaje);
    };

    useEffect(() => {
        obtenerCatalogoGastosCompleto().then((cats) => {
            setCatalogoGastos(cats);
        }).catch(console.error);

        getPacientes().then((pacs) => {
            const activos = pacs.filter((p) => !p.eliminado);
            setPacientesLista(activos);

            // Detectar cumpleaños próximos (próximos 30 días sin desfases UTC)
            const cumples = obtenerProximosCumpleanos(activos, 30);
            setCumpleanosPacientes(cumples);
        }).catch(console.error);

        getStaff().then(setStaffList).catch(console.error);

        const unsubInv = onInventarioChange((data) => {
            const soloProductos = data.filter((i) => i.tipo === 'producto');
            setInventario(soloProductos);
        });

        const unsubServ = onServiciosChange(setServiciosCat);
        const unsubPlanes = onPlanesChange(setPlanesList);
        const unsubMovs = onMovimientosChange(setTodosMovimientos);
        const unsubCajas = onCajasDiariasChange(setCajasMap);
        const unsubCitas = onCitasChange(setCitasList);

        return () => {
            if (unsubInv) unsubInv();
            if (unsubServ) unsubServ();
            if (unsubMovs) unsubMovs();
            if (unsubPlanes) unsubPlanes();
            if (unsubCajas) unsubCajas();
            if (unsubCitas) unsubCitas();
        };
    }, []);

    // Categorías disponibles para el rol actual (Recepcionista ve todas las operativas; Admin ve todas)
    const categoriasDisponibles = useMemo(() => {
        if (userRole === 'Administrador') return catalogoGastos;
        return catalogoGastos.filter((c) => c.disponibleRecepcion !== false);
    }, [catalogoGastos, userRole]);

    const categoriaSeleccionadaObj = useMemo(() => {
        return (
            categoriasDisponibles.find((c) => c.nombre === categoriaGasto) ||
            categoriasDisponibles[0] ||
            CATALOGO_CATEGORIAS_GASTO[0]
        );
    }, [categoriasDisponibles, categoriaGasto]);

    // Actualizar motivo por defecto cuando cambia la categoría
    const handleCambiarCategoriaGasto = (nuevaCat) => {
        setCategoriaGasto(nuevaCat);
        const found = catalogoGastos.find((c) => c.nombre === nuevaCat);
        if (found && found.motivos?.length > 0) {
            setMotivoGastoCatalogo(found.motivos[0]);
        } else {
            setMotivoGastoCatalogo('');
        }
    };

    const handleAgregarMotivoCatalogo = async () => {
        const limpio = nuevoMotivoPersonalizado.trim();
        if (!limpio) return;
        await agregarMotivoPersonalizadoGasto(categoriaGasto, limpio);
        const actualizado = await obtenerCatalogoGastosCompleto();
        setCatalogoGastos(actualizado);
        setMotivoGastoCatalogo(limpio);
        setNuevoMotivoPersonalizado('');
        setMostrarInputNuevoMotivo(false);
    };

    // Movimientos de la fecha de operación seleccionada (alineado 100% con Corte de Caja)
    const movimientosHoy = useMemo(() => {
        return todosMovimientos.filter((m) => {
            const f = String(m.fecha || m.createdAt || '').substring(0, 10);
            return f === fechaOperacion;
        });
    }, [todosMovimientos, fechaOperacion]);

    // Datos de la Caja Diaria actual (Fondo Inicial, Retiros, Arqueo)
    const cajaDiaActual = useMemo(() => {
        return cajasMap[fechaOperacion] || {};
    }, [cajasMap, fechaOperacion]);

    // Resumen Financiero del Día (Exactamente la misma fórmula que CorteCajaGlobal)
    const resumenCajaDia = useMemo(() => {
        let ingresosTotales = 0;
        let ingresosEfectivo = 0;
        let ingresosTarjeta = 0;
        let ingresosTransferencia = 0;
        let egresosTotales = 0;
        let egresosEfectivoCaja = 0;
        let egresosOtrosMedios = 0;

        movimientosHoy.forEach((m) => {
            if (m.estado === 'Cancelado') return;
            const montoNum = Number(m.monto) || 0;
            if (m.tipo === 'Ingreso') {
                ingresosTotales += montoNum;
                if (m.desglosePago && typeof m.desglosePago === 'object') {
                    ingresosEfectivo += Number(m.desglosePago.efectivo) || 0;
                    ingresosTarjeta += Number(m.desglosePago.tarjeta) || 0;
                    ingresosTransferencia += Number(m.desglosePago.transferencia) || 0;
                } else {
                    const met = String(m.metodoPago || '').toLowerCase();
                    if (met.includes('tarjeta') || met.includes('debito') || met.includes('credito')) {
                        ingresosTarjeta += montoNum;
                    } else if (met.includes('transfer')) {
                        ingresosTransferencia += montoNum;
                    } else if (met.includes('cortesia') || met.includes('puntos')) {
                        // $0
                    } else {
                        ingresosEfectivo += montoNum;
                    }
                }
            } else if (m.tipo === 'Egreso') {
                egresosTotales += montoNum;
                if (esGastoDeCajaDelDia(m)) {
                    egresosEfectivoCaja += montoNum;
                } else {
                    egresosOtrosMedios += montoNum;
                }
            }
        });

        const fondoInicial = Number(cajaDiaActual.fondoInicial) || 0;
        const retiros = Array.isArray(cajaDiaActual.retirosEfectivo) ? cajaDiaActual.retirosEfectivo : [];
        const totalRetiros = retiros.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
        const efectivoEsperadoEnCajon = fondoInicial + ingresosEfectivo - egresosEfectivoCaja - totalRetiros;

        return {
            fondoInicial,
            ingresosTotales,
            ingresosEfectivo,
            ingresosTarjeta,
            ingresosTransferencia,
            egresosTotales,
            egresosEfectivoCaja,
            egresosOtrosMedios,
            retiros,
            totalRetiros,
            efectivoEsperadoEnCajon,
            utilidadDia: ingresosTotales - egresosTotales,
        };
    }, [movimientosHoy, cajaDiaActual]);

    // Solicitudes de Autorización de Pase a Caja en Cita Única (Enviadas por Especialistas)
    const citasPendientesAutorizacionPase = useMemo(() => {
        return citasList.filter((c) => {
            return c.status === 'Pendiente Pase a Caja' || c.paseCaja?.estadoAutorizacion === 'pendiente_recepcion';
        });
    }, [citasList]);

    const handleAutorizarPaseCajaCitaUnica = async (cita) => {
        try {
            await updateCitaStatus(cita.id, 'Completada', {
                paseCaja: {
                    ...(cita.paseCaja || {}),
                    estadoAutorizacion: 'autorizado',
                    autorizadoPor: currentUser?.email || userRole || 'Recepción',
                    autorizadoEn: new Date().toISOString(),
                },
            });
            handlePrellenarCobroDesdeCita(cita);
        } catch (err) {
            console.error(err);
            alert('Error al autorizar el Pase a Caja: ' + err.message);
        }
    };

    const handleRechazarPaseCajaCitaUnica = async (cita) => {
        try {
            await updateCitaStatus(cita.id, 'En Cabina', {
                paseCaja: {
                    ...(cita.paseCaja || {}),
                    estadoAutorizacion: 'rechazado',
                    rechazadoPor: currentUser?.email || userRole || 'Recepción',
                    rechazadoEn: new Date().toISOString(),
                },
            });
        } catch (err) {
            console.error(err);
            alert('Error al rechazar el Pase a Caja: ' + err.message);
        }
    };

    // Citas completadas en la fecha de operación que aún no registran cobro en caja
    const citasCompletadasSinCobro = useMemo(() => {
        const citasDelDia = citasList.filter((c) => {
            const f = String(c.fecha || c.fechaHora || '').substring(0, 10);
            return f === fechaOperacion && c.status === 'Completada';
        });

        const pacientesConCobroHoy = new Set(
            movimientosHoy
                .filter((m) => m.tipo === 'Ingreso' && m.estado !== 'Cancelado')
                .map((m) => String(m.pacienteNombre || '').trim().toLowerCase())
        );

        return citasDelDia.filter((c) => {
            const nom = String(c.pacienteNombre || c.paciente || '').trim().toLowerCase();
            return nom && !pacientesConCobroHoy.has(nom);
        });
    }, [citasList, fechaOperacion, movimientosHoy]);

    const handlePrellenarCobroDesdeCita = (cita) => {
        const nombrePac = cita.pacienteNombre || cita.paciente || '';
        const pacObj = pacientesLista.find(
            (p) => String(p.nombre || '').trim().toLowerCase() === nombrePac.trim().toLowerCase()
        );
        if (pacObj) {
            seleccionarPaciente(pacObj);
        } else {
            setPacienteNombre(nombrePac);
            setBusquedaPaciente(nombrePac);
            setPacienteTelefono(cita.telefono || '');
        }

        if (cita.especialistaId) {
            setSelectedStaffId(cita.especialistaId);
        }

        // Si el Pase a Caja trae items recomendados, precargarlos en la lista de cobro
        const recomendados = cita.paseCaja?.itemsRecomendados || [];
        if (recomendados.length > 0) {
            const itemsCargados = recomendados.map((item) => ({
                motivo: item.nombre,
                monto: Number(item.precio) || 0,
                productoId: item.tipo === 'Producto' ? item.id : null,
                productoNombre: item.tipo === 'Producto' ? item.nombre : null,
                servicioId: item.tipo === 'Servicio' ? item.id : null,
                servicioNombre: item.tipo === 'Servicio' ? item.nombre : null,
            }));
            setListaItems(itemsCargados);
        }

        if (cita.servicio) {
            const servObj = serviciosCat.find(
                (s) => String(s.nombre || '').trim().toLowerCase() === String(cita.servicio).trim().toLowerCase()
            );
            if (servObj) {
                setMotivo(servObj.nombre);
                setMonto(String(servObj.precioVenta ?? servObj.precio ?? ''));
                setServicioSeleccionado(servObj);
            } else {
                setMotivo(cita.servicio);
            }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Abrir modal Fondo Inicial / Retiros
    const abrirModalFondo = () => {
        setFondoInicialInput(String(resumenCajaDia.fondoInicial || ''));
        setRetiroMonto('');
        setRetiroConcepto('');
        setModalFondoOpen(true);
    };

    const handleGuardarFondoInicial = async () => {
        setSavingCajaConfig(true);
        try {
            await guardarCajaDiaria(fechaOperacion, {
                fondoInicial: Number(fondoInicialInput) || 0,
            });
            setModalFondoOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error al guardar el fondo inicial de caja.');
        } finally {
            setSavingCajaConfig(false);
        }
    };

    const handleRegistrarRetiroParcial = async () => {
        const montoNum = Number(retiroMonto);
        if (!montoNum || montoNum <= 0) {
            alert('Ingresa un monto válido para el retiro parcial de efectivo.');
            return;
        }
        setSavingCajaConfig(true);
        try {
            const actuales = Array.isArray(cajaDiaActual.retirosEfectivo) ? cajaDiaActual.retirosEfectivo : [];
            const nuevoRetiro = {
                id: `ret_${Date.now()}`,
                monto: montoNum,
                concepto: retiroConcepto.trim() || 'Entrega parcial a Administración',
                recibe: retiroRecibe || 'Administración',
                hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                registradoPor: currentUser?.email || userRole || 'Recepción',
            };
            await guardarCajaDiaria(fechaOperacion, {
                retirosEfectivo: [...actuales, nuevoRetiro],
            });
            setRetiroMonto('');
            setRetiroConcepto('');
        } catch (err) {
            console.error(err);
            alert('Error al registrar el retiro de caja.');
        } finally {
            setSavingCajaConfig(false);
        }
    };

    const handleEliminarRetiro = async (retiroId) => {
        try {
            const actuales = Array.isArray(cajaDiaActual.retirosEfectivo) ? cajaDiaActual.retirosEfectivo : [];
            await guardarCajaDiaria(fechaOperacion, {
                retirosEfectivo: actuales.filter((r) => r.id !== retiroId),
            });
        } catch (err) {
            console.error(err);
        }
    };

    // Abrir Modal de Arqueo Físico
    const abrirModalArqueo = () => {
        const arqueoPrevio = cajaDiaActual.arqueo?.cantidades || {};
        setConteoDenominaciones(arqueoPrevio);
        setEntregadoPorNombre(cajaDiaActual.entregadoPor || currentUser?.displayName || currentUser?.email || 'Recepción');
        setNotasRecepcionCorte(cajaDiaActual.notasRecepcion || '');
        setModalArqueoOpen(true);
    };

    const totalContadoArqueo = useMemo(() => {
        return DENOMINACIONES_ARQUEO.reduce((acc, d) => {
            const cant = Number(conteoDenominaciones[d.valor]) || 0;
            return acc + cant * d.valor;
        }, 0);
    }, [conteoDenominaciones]);

    const diferenciaArqueoActual = totalContadoArqueo - resumenCajaDia.efectivoEsperadoEnCajon;

    const handleGuardarArqueoYEntregar = async () => {
        setSavingArqueo(true);
        try {
            await guardarCajaDiaria(fechaOperacion, {
                fondoInicial: resumenCajaDia.fondoInicial,
                arqueo: {
                    cantidades: conteoDenominaciones,
                    totalContado: totalContadoArqueo,
                    efectivoEsperado: resumenCajaDia.efectivoEsperadoEnCajon,
                    diferencia: diferenciaArqueoActual,
                    actualizadoEn: new Date().toISOString(),
                },
                entregadoRecepcion: true,
                entregadoPor: entregadoPorNombre.trim() || 'Recepción',
                entregadoEn: new Date().toISOString(),
                notasRecepcion: notasRecepcionCorte.trim(),
            });
            setModalArqueoOpen(false);
            alert('✅ Arqueo físico guardado y Corte de Caja sincronizado con el Administrador.');
        } catch (err) {
            console.error(err);
            alert('Error al guardar el arqueo de caja.');
        } finally {
            setSavingArqueo(false);
        }
    };

    // Registrar Gasto desde Recepción / Caja (SIEMPRE CON CATEGORÍA OBLIGATORIA)
    const handleRegistrarGastoRecepcion = async () => {
        if (!categoriaGasto) {
            alert('⚠️ Todo gasto sin excepción debe pertenecer a una categoría oficial.');
            return;
        }
        const montoNum = parseFloat(montoGasto);
        if (!montoNum || montoNum <= 0) {
            alert('⚠️ Ingresa un monto válido para el gasto.');
            return;
        }
        const baseMotivo = motivoGastoCatalogo.trim();
        const extra = detalleGastoExtra.trim();
        const motivoFinal = baseMotivo && extra
            ? `${baseMotivo} — ${extra}`
            : baseMotivo || extra;

        if (!motivoFinal) {
            alert('⚠️ Selecciona o especifica el motivo del gasto.');
            return;
        }

        setSavingGasto(true);
        try {
            const fechaOperacionIso = fechaOperacion === hoyEstandar
                ? toLocalISOString()
                : new Date(`${fechaOperacion}T12:00:00.000Z`).toISOString();

            const categoriaNormalizada = normalizarCategoriaGasto({
                categoria: categoriaGasto,
                motivo: motivoFinal,
            });

            await registrarMovimiento({
                tipo: 'Egreso',
                monto: montoNum,
                categoria: categoriaNormalizada,
                motivo: motivoFinal,
                motivoCatalogo: baseMotivo || motivoFinal,
                detalleExtra: extra || null,
                proveedor: proveedorGasto.trim() || null,
                folioNota: folioNotaGasto.trim() || null,
                metodoPago: origenGasto || 'Efectivo en Caja',
                estado: 'Pagado',
                registradoPor: userRole || 'Recepcionista',
                usuarioEmail: currentUser?.email || null,
                origenModulo: 'CajaRecepcion',
                fecha: fechaOperacionIso,
            });

            setMontoGasto('');
            setDetalleGastoExtra('');
            setProveedorGasto('');
            setFolioNotaGasto('');
        } catch (err) {
            console.error(err);
            alert('Error al registrar el gasto en caja.');
        } finally {
            setSavingGasto(false);
        }
    };

    const handleSolicitarCancelacion = (id) => {
        setCancelacionId(id);
        setMotivoCancelacion('');
        setModalCancelacionOpen(true);
    };

    const confirmarCancelacion = async () => {
        if (!motivoCancelacion || motivoCancelacion.trim() === '') {
            alert('Debes ingresar un motivo para poder solicitar la cancelación.');
            return;
        }

        try {
            await solicitarCancelacionMovimiento(cancelacionId, motivoCancelacion);
            alert('Solicitud enviada al Administrador.');
            setModalCancelacionOpen(false);
        } catch (err) {
            alert(`Error al solicitar cancelación: ${err.message || 'Intenta de nuevo.'}`);
            console.error(err);
        }
    };

    const handleCanjearRecompensa = async () => {
        if (!recompensaDetalle.trim()) {
            alert('Debes indicar cuál fue la recompensa entregada.');
            return;
        }
        if (!pacienteId || !pacienteSeleccionadoData) return;

        try {
            const actuales = pacienteSeleccionadoData.recompensasDisponibles || 0;
            if (actuales > 0) {
                await updatePaciente(pacienteId, {
                    recompensasDisponibles: actuales - 1,
                });

                setPacienteSeleccionadoData((prev) => ({
                    ...prev,
                    recompensasDisponibles: actuales - 1,
                }));

                await registrarMovimiento({
                    tipo: 'Ingreso',
                    monto: 0,
                    motivo: `Recompensa Canjeada: ${recompensaDetalle}`,
                    metodoPago: 'Cortesía / Puntos',
                    pacienteId: pacienteId,
                    pacienteNombre: pacienteNombre,
                    fecha: new Date().toISOString(),
                });

                alert('Recompensa canjeada con éxito.');
                setModalRecompensaOpen(false);
                setRecompensaDetalle('');
            }
        } catch (err) {
            console.error('Error al canjear:', err);
            alert('Error al canjear recompensa.');
        }
    };

    const handleToggleLealtad = async () => {
        if (!pacienteId || !pacienteSeleccionadoData) return;
        const nuevoEstado = pacienteSeleccionadoData.lealtadActiva !== false ? false : true;
        try {
            await updatePaciente(pacienteId, { lealtadActiva: nuevoEstado });
            setPacienteSeleccionadoData((prev) => ({ ...prev, lealtadActiva: nuevoEstado }));
        } catch (err) {
            console.error(err);
            alert('Error al actualizar estado de lealtad.');
        }
    };

    const pacientesFiltrados = pacientesLista
        .filter((p) => p.nombre?.toLowerCase().includes(busquedaPaciente.toLowerCase()))
        .slice(0, 6);

    const seleccionarPaciente = (p) => {
        setPacienteNombre(p.nombre);
        setPacienteId(p.id);
        setPacienteTelefono(p.telefono || p.phone || '');
        setPacienteSeleccionadoData(p);
        setBusquedaPaciente(p.nombre);
        setMostrarSugerencias(false);
    };

    const productosFiltrados = inventario
        .filter((p) => p.nombre?.toLowerCase().includes(motivo.toLowerCase()))
        .slice(0, 5);

    const serviciosFiltrados = serviciosCat
        .filter((s) => s.nombre?.toLowerCase().includes(motivo.toLowerCase()))
        .slice(0, 5);

    const seleccionarProducto = (prod) => {
        setMotivo(prod.nombre);
        setMonto(prod.precio?.toString() || '');
        setProductoSeleccionado(prod);
        setServicioSeleccionado(null);
        setMostrarSugerenciasProducto(false);
    };

    const seleccionarServicio = (serv) => {
        setMotivo(serv.nombre);
        setMonto((serv.precioVenta ?? serv.precio)?.toString() || '');
        setServicioSeleccionado(serv);
        setProductoSeleccionado(null);
        setMostrarSugerenciasProducto(false);
    };

    const handleAgregarItem = () => {
        if (!motivo || !monto) {
            alert('Por favor llena el motivo y el monto del item.');
            return;
        }
        setListaItems([
            ...listaItems,
            {
                motivo,
                monto: parseFloat(monto),
                productoId: productoSeleccionado?.id || null,
                productoNombre: productoSeleccionado?.nombre || null,
                servicioId: servicioSeleccionado?.id || null,
                servicioNombre: servicioSeleccionado?.nombre || null,
            },
        ]);
        setMotivo('');
        setMonto('');
        setProductoSeleccionado(null);
        setServicioSeleccionado(null);
        setMostrarSugerenciasProducto(false);
    };

    const handleEliminarItem = (idx) => {
        setListaItems(listaItems.filter((_, i) => i !== idx));
    };

    const procesarLealtad = async (idPaciente) => {
        if (!idPaciente) return;
        try {
            const paciente = await getPacienteById(idPaciente);
            if (paciente) {
                let sellosAct = paciente.sellosLealtad || 0;
                let recompensasAct = paciente.recompensasDisponibles || 0;

                sellosAct += 1;
                if (sellosAct >= 7) {
                    sellosAct = 0;
                    recompensasAct += 1;
                }

                await updatePaciente(idPaciente, {
                    sellosLealtad: sellosAct,
                    recompensasDisponibles: recompensasAct,
                });
            }
        } catch (e) {
            console.error('Error procesando lealtad:', e);
        }
    };

    const obtenerItemsActuales = () => {
        const itemsAProcesar = [...listaItems];
        if (motivo && monto) {
            itemsAProcesar.push({
                motivo,
                monto: parseFloat(monto),
                productoId: productoSeleccionado?.id || null,
                productoNombre: productoSeleccionado?.nombre || null,
                servicioId: servicioSeleccionado?.id || null,
                servicioNombre: servicioSeleccionado?.nombre || null,
            });
        }
        return itemsAProcesar;
    };

    const abrirPagoMixtoServicio = () => {
        const items = obtenerItemsActuales();
        if (items.length === 0) {
            alert('Por favor agrega al menos un servicio o producto.');
            return;
        }
        if (!pacienteNombre) {
            alert('Por favor selecciona un paciente.');
            return;
        }
        const total = items.reduce((a, b) => a + (Number(b.monto) || 0), 0);
        setMixtoContext('servicio');
        setMixtoEfectivo(String(Math.round(total / 2)));
        setMixtoTarjeta(String(total - Math.round(total / 2)));
        setMixtoTransferencia('0');
        setModalMixtoOpen(true);
    };

    const abrirPagoMixtoAbono = () => {
        if (!planSeleccionadoAbono || !montoAbono) {
            alert('⚠️ Selecciona un plan de tratamiento e ingresa el monto del abono.');
            return;
        }
        const total = parseFloat(montoAbono) || 0;
        setMixtoContext('abono');
        setMixtoEfectivo(String(Math.round(total / 2)));
        setMixtoTarjeta(String(total - Math.round(total / 2)));
        setMixtoTransferencia('0');
        setModalMixtoOpen(true);
    };

    const handleConfirmarPagoMixto = async () => {
        const ef = Number(mixtoEfectivo) || 0;
        const tj = Number(mixtoTarjeta) || 0;
        const tr = Number(mixtoTransferencia) || 0;
        const sumaMixto = ef + tj + tr;

        if (mixtoContext === 'servicio') {
            const items = obtenerItemsActuales();
            const totalEsperado = items.reduce((a, b) => a + (Number(b.monto) || 0), 0);
            if (Math.abs(sumaMixto - totalEsperado) > 0.5) {
                alert(`La suma del desglose (${formatMoney(sumaMixto)}) debe coincidir con el total a cobrar (${formatMoney(totalEsperado)}).`);
                return;
            }
            const partes = [];
            if (ef > 0) partes.push(`Efectivo ${formatMoney(ef)}`);
            if (tj > 0) partes.push(`Tarjeta ${formatMoney(tj)}`);
            if (tr > 0) partes.push(`Transf. ${formatMoney(tr)}`);
            setModalMixtoOpen(false);
            await handleCobrar(`Pago Mixto (${partes.join(' + ')})`, {
                efectivo: ef,
                tarjeta: tj,
                transferencia: tr,
            });
        } else {
            const totalEsperado = parseFloat(montoAbono) || 0;
            if (Math.abs(sumaMixto - totalEsperado) > 0.5) {
                alert(`La suma del desglose (${formatMoney(sumaMixto)}) debe coincidir con el abono (${formatMoney(totalEsperado)}).`);
                return;
            }
            const partes = [];
            if (ef > 0) partes.push(`Efectivo ${formatMoney(ef)}`);
            if (tj > 0) partes.push(`Tarjeta ${formatMoney(tj)}`);
            if (tr > 0) partes.push(`Transf. ${formatMoney(tr)}`);
            setModalMixtoOpen(false);
            await handleRegistrarAbono(`Pago Mixto (${partes.join(' + ')})`, {
                efectivo: ef,
                tarjeta: tj,
                transferencia: tr,
            });
        }
    };

    const handleCobrar = async (metodo, desglosePago = null) => {
        const itemsAProcesar = obtenerItemsActuales();

        if (itemsAProcesar.length === 0) {
            alert('Por favor agrega al menos un servicio o producto.');
            return;
        }

        if (!pacienteNombre) {
            alert('Por favor selecciona un paciente.');
            return;
        }

        setSaving(true);
        try {
            const totalMonto = itemsAProcesar.reduce((acc, item) => acc + item.monto, 0);
            const conceptoCombinado = itemsAProcesar.map((item) => item.motivo).join(', ');

            const fechaOperacionIso = fechaOperacion === hoyEstandar
                ? toLocalISOString()
                : new Date(`${fechaOperacion}T12:00:00.000Z`).toISOString();

            await registrarMovimiento({
                tipo: 'Ingreso',
                monto: totalMonto,
                motivo: conceptoCombinado,
                metodoPago: metodo,
                desglosePago: desglosePago || null,
                pacienteId: pacienteId || null,
                pacienteNombre: pacienteNombre,
                fecha: fechaOperacionIso,
                registradoPor: userRole || 'Recepcionista',
                productoId: itemsAProcesar.find((i) => i.productoId)?.productoId || null,
                productoNombre: itemsAProcesar.find((i) => i.productoId)?.motivo || null,
                cantidadVendida: itemsAProcesar.some((i) => i.productoId) ? 1 : null,
            });

            const recibo = await createRecibo({
                pacienteId: pacienteId || null,
                pacienteNombre,
                concepto: conceptoCombinado,
                monto: totalMonto,
                metodoPago: metodo,
                paqueteInfo: paqueteInfo || null,
                telefono: pacienteTelefono || '',
                fecha: fechaOperacionIso,
            });

            // Descontar del inventario para CADA producto
            try {
                for (const item of itemsAProcesar) {
                    if (item.productoId) {
                        const prodInInv = inventario.find((p) => p.id === item.productoId);
                        if (prodInInv) {
                            const nuevoStock = Math.max(0, (Number(prodInInv.stock) || 0) - 1);
                            await updateInventarioItem(item.productoId, {
                                stock: nuevoStock,
                            });
                        }
                    }
                }
            } catch (invErr) {
                console.error('Error al descontar inventario:', invErr);
            }

            // Asignar Comisión a Staff si se seleccionó uno
            if (selectedStaffId) {
                try {
                    let totalProductos = 0;
                    let motivosProductos = [];
                    let totalServicios = 0;
                    let motivosServicios = [];

                    for (const item of itemsAProcesar) {
                        if (item.productoId) {
                            totalProductos += item.monto;
                            motivosProductos.push(item.motivo);
                        } else {
                            totalServicios += item.monto;
                            motivosServicios.push(item.motivo);
                        }
                    }

                    if (totalProductos > 0) {
                        await asignarComision(selectedStaffId, totalProductos, 'Producto', motivosProductos.join(', '), pacienteNombre);
                    }
                    if (totalServicios > 0) {
                        await asignarComision(selectedStaffId, totalServicios, 'Servicio', motivosServicios.join(', '), pacienteNombre);
                    }
                } catch (comErr) {
                    console.error('Error al asignar comisión:', comErr);
                }
            }

            setDatosReciboActual({
                ...recibo,
                fecha: recibo.fechaLegible,
            });
            setIsReciboOpen(true);

// Sellado automático de lealtad eliminado por solicitud del usuario (solo manual desde recepción)

            setMonto('');
            setMotivo('');
            setListaItems([]);
            setProductoSeleccionado(null);
            setServicioSeleccionado(null);
            setMostrarSugerenciasProducto(false);
            setSelectedStaffId('');
            setPacienteNombre('');
            setPacienteId(null);
            setPacienteTelefono('');
            setPacienteSeleccionadoData(null);
            setPaqueteInfo('');
            setBusquedaPaciente('');
        } catch (err) {
            console.error(err);
            alert('Error al registrar el pago. Revisa tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    const handleRegistrarAbono = async (metodo, desglosePago = null) => {
        if (!planSeleccionadoAbono || !montoAbono) {
            alert('⚠️ Selecciona un plan de tratamiento de la lista para continuar con el abono.');
            return;
        }
        setSavingAbono(true);
        try {
            const fechaOperacionIso = fechaOperacion === hoyEstandar
                ? toLocalISOString()
                : new Date(`${fechaOperacion}T12:00:00.000Z`).toISOString();

            const movId = await registrarMovimiento({
                tipo: 'Ingreso',
                subTipo: 'abono_tratamiento',
                motivo: `Abono a Plan de Tratamiento — ${planSeleccionadoAbono.paciente} (${planSeleccionadoAbono.objetivo})`,
                monto: parseFloat(montoAbono),
                pacienteNombre: planSeleccionadoAbono.paciente,
                fecha: fechaOperacionIso,
                metodoPago: metodo,
                desglosePago: desglosePago || null,
                registradoPor: userRole || 'Recepcionista',
            });

            try {
                await updatePlan(planSeleccionadoAbono.id, {
                    acumulado: parseFloat(planSeleccionadoAbono.acumulado || 0) + parseFloat(montoAbono),
                });
            } catch (errPlan) {
                console.error('Error al actualizar acumulado del plan:', errPlan);
            }

            const pacEncontrado = (pacientesLista || []).find(
                (p) => (p.nombre || '').trim().toLowerCase() === (planSeleccionadoAbono.paciente || '').trim().toLowerCase()
            );
            const recibo = await createRecibo({
                pacienteId: planSeleccionadoAbono.pacienteId || pacEncontrado?.id || null,
                pacienteNombre: planSeleccionadoAbono.paciente,
                concepto: `Abono a Plan de Tratamiento — ${planSeleccionadoAbono.objetivo}`,
                monto: parseFloat(montoAbono),
                metodoPago: metodo,
                paqueteInfo: planSeleccionadoAbono.objetivo,
                telefono: pacEncontrado?.telefono || '',
                fecha: fechaOperacionIso,
            });

            try {
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('../../lib/firebase');
                await updateDoc(doc(db, 'finanzas', movId), { reciboId: recibo.id });
            } catch (errFinanzas) {
                console.error('Error vinculando recibo con movimiento:', errFinanzas);
            }

            setDatosReciboActual({
                ...recibo,
                fecha: recibo.fechaLegible,
            });
            setIsReciboOpen(true);

            setPacienteAbono('');
            setPlanSeleccionadoAbono(null);
            setMontoAbono('');
        } catch (err) {
            console.error(err);
            alert('Error al registrar el abono.');
        } finally {
            setSavingAbono(false);
        }
    };

    const movimientosFiltradosDia = useMemo(() => {
        if (filtroMovsDia === 'Todos') return movimientosHoy;
        return movimientosHoy.filter((m) => m.tipo === filtroMovsDia);
    }, [movimientosHoy, filtroMovsDia]);

    return (
        <div className="space-y-6 relative pb-20">
            <ReciboDigital
                isOpen={isReciboOpen}
                onClose={() => setIsReciboOpen(false)}
                datosRecibo={datosReciboActual}
            />

            {/* ── Header y Control de Fecha de Operación ──────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-acero">Caja y Recepción</h2>
                        {cajaDiaActual.estado === 'Aprobado' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                <ShieldCheck size={14} /> Corte Auditado por Administración
                            </span>
                        ) : cajaDiaActual.entregadoRecepcion ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-700 flex items-center gap-1">
                                <CheckCircle size={14} /> Arqueo Entregado ({formatMoney(cajaDiaActual.arqueo?.totalContado)})
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                Turno Abierto
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm">
                        Sincronizado en tiempo real con el Corte de Caja y Contabilidad del Administrador
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase">Fecha Caja:</span>
                        <input
                            type="date"
                            value={fechaOperacion}
                            max={hoyEstandar}
                            onChange={(e) => setFechaOperacion(e.target.value || hoyEstandar)}
                            className="text-sm font-black text-acero outline-none bg-transparent cursor-pointer"
                        />
                    </div>
                    <Button variant="outline" icon={Wallet} onClick={abrirModalFondo}>
                        Fondo / Retiros
                    </Button>
                    <Button
                        variant="primary"
                        icon={Calculator}
                        onClick={abrirModalArqueo}
                        className="bg-acero border-acero hover:bg-slate-800 text-white"
                    >
                        Arqueo y Cerrar Turno
                    </Button>
                </div>
            </div>

            {/* ── Barra en Vivo de Estado del Cajón (Alineada con Corte de Caja) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div
                    onClick={abrirModalFondo}
                    className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm cursor-pointer hover:border-turquesa transition-colors"
                >
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fondo Inicial</p>
                    <p className="text-lg font-black text-gray-800 mt-0.5">{formatMoney(resumenCajaDia.fondoInicial)}</p>
                    <span className="text-[10px] text-turquesa font-bold">Clic para editar</span>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">+ Cobros Efectivo</p>
                    <p className="text-lg font-black text-emerald-600 mt-0.5">{formatMoney(resumenCajaDia.ingresosEfectivo)}</p>
                    <span className="text-[10px] text-gray-400">Entradas en billetes/monedas</span>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-rose-100 shadow-sm">
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">− Gastos de Caja</p>
                    <p className="text-lg font-black text-rose-600 mt-0.5">{formatMoney(resumenCajaDia.egresosEfectivoCaja)}</p>
                    <span className="text-[10px] text-gray-400">
                        {resumenCajaDia.egresosOtrosMedios > 0
                            ? `+ ${formatMoney(resumenCajaDia.egresosOtrosMedios)} banco`
                            : 'Pagados del cajón'}
                    </span>
                </div>

                <div
                    onClick={abrirModalFondo}
                    className="bg-white rounded-2xl p-3.5 border border-amber-100 shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
                >
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">− Retiros Parciales</p>
                    <p className="text-lg font-black text-amber-600 mt-0.5">{formatMoney(resumenCajaDia.totalRetiros)}</p>
                    <span className="text-[10px] text-gray-400">{resumenCajaDia.retiros.length} entregas a Admin</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-3.5 text-white shadow-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">= Efectivo en Cajón</p>
                    <p className="text-xl font-black mt-0.5">{formatMoney(resumenCajaDia.efectivoEsperadoEnCajon)}</p>
                    <span className="text-[10px] opacity-80">Debe haber físicamente</span>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-3.5 text-white shadow-md">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-turquesa">Total Ingresos Día</p>
                    <p className="text-xl font-black mt-0.5">{formatMoney(resumenCajaDia.ingresosTotales)}</p>
                    <span className="text-[10px] text-gray-300">
                        Tarjeta/Transf: {formatMoney(resumenCajaDia.ingresosTarjeta + resumenCajaDia.ingresosTransferencia)}
                    </span>
                </div>
            </div>

            {/* ── Solicitudes de Autorización de Pase a Caja (Cita Única) ──── */}
            {citasPendientesAutorizacionPase.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl animate-pulse">
                            <Bell size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                                🔒 {citasPendientesAutorizacionPase.length} Solicitud(es) de Autorización de Pase a Caja (Cita Única sin Próxima Cita)
                            </h4>
                            <p className="text-xs text-amber-800">
                                La especialista solicita autorización de Recepción para cerrar la cita como <strong>Cita Única</strong>. Al autorizar, la cita se cierra satisfactoriamente y se precarga en Caja:
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {citasPendientesAutorizacionPase.map((c) => (
                            <div
                                key={c.id}
                                className="bg-white border border-amber-300 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-black text-acero">
                                            👤 {c.pacienteNombre || c.paciente}
                                        </span>
                                        <span className="text-[11px] font-bold bg-turquesa/10 text-acero px-2 py-0.5 rounded-lg">
                                            👩‍⚕️ {c.paseCaja?.atendidoPor || c.especialistaNombre || 'Especialista'}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-700">
                                        Servicio: <span className="text-turquesa">{c.servicio}</span>
                                    </p>
                                    {c.paseCaja?.motivoCitaUnica && (
                                        <p className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                            <strong>Motivo Cita Única:</strong> {c.paseCaja.motivoCitaUnica}
                                        </p>
                                    )}
                                    {c.paseCaja?.itemsRecomendados?.length > 0 && (
                                        <p className="text-[11px] font-bold text-emerald-700">
                                            🛒 Recomendados: {c.paseCaja.itemsRecomendados.map((i) => `${i.nombre} ($${i.precio || 0})`).join(', ')}
                                        </p>
                                    )}
                                    {c.paseCaja?.notaRecepcion && (
                                        <p className="text-[11px] text-gray-500 italic">
                                            Nota: "{c.paseCaja.notaRecepcion}"
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => handleAutorizarPaseCajaCitaUnica(c)}
                                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer"
                                    >
                                        ✅ Autorizar Pase a Caja y Cerrar Cita
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRechazarPaseCajaCitaUnica(c)}
                                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        ❌ Rechazar (Pedir agendar cita)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Alerta de Citas Completadas Hoy Pendientes de Cobro ──────── */}
            {citasCompletadasSinCobro.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-amber-900">
                                {citasCompletadasSinCobro.length} Cita(s) Completada(s) Hoy sin Cobro Registrado en Caja
                            </h4>
                            <p className="text-xs text-amber-700">
                                Haz clic en el paciente para cargar automáticamente sus datos en la terminal de cobro:
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {citasCompletadasSinCobro.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => handlePrellenarCobroDesdeCita(c)}
                                className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                <span>Cobrar a {c.pacienteNombre || c.paciente}</span>
                                {c.servicio && <span className="text-[10px] text-amber-600">({c.servicio})</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tarjetas Principales: Cobro, Abono a Planes y Registro de Gastos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Cobro de Servicio o Producto */}
                <Card title="1. Cobrar Servicio o Producto" className="border-t-4 border-t-turquesa shadow-sm">
                    <div className="space-y-4">
                        {/* Buscar Paciente */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Paciente</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar paciente registrado..."
                                    value={busquedaPaciente}
                                    onChange={(e) => {
                                        setBusquedaPaciente(e.target.value);
                                        setPacienteNombre(e.target.value);
                                        setMostrarSugerencias(e.target.value.length > 1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-1 focus:ring-turquesa outline-none"
                                />
                                {mostrarSugerencias && pacientesFiltrados.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-20 mt-1">
                                        {pacientesFiltrados.map((p) => (
                                            <div
                                                key={p.id}
                                                className="px-4 py-3 hover:bg-turquesa/5 cursor-pointer flex justify-between items-center"
                                                onClick={() => seleccionarPaciente(p)}
                                            >
                                                <span className="font-medium text-gray-800">{p.nombre}</span>
                                                <span className="text-xs text-gray-400">{p.telefono || p.phone || ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {pacienteSeleccionadoData && (
                                <div className="mt-2 p-3 bg-turquesa/5 border border-turquesa/20 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-acero">Programa de Lealtad ALFRA</p>
                                        <p className="text-[10px] text-gray-500">
                                            Sellos acumulados: <strong className="text-turquesa">{pacienteSeleccionadoData.sellosLealtad || 0}/7</strong>
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            onClick={handleToggleLealtad}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                pacienteSeleccionadoData.lealtadActiva !== false
                                                    ? 'bg-turquesa text-white'
                                                    : 'bg-gray-200 text-gray-500'
                                            }`}
                                        >
                                            {pacienteSeleccionadoData.lealtadActiva !== false ? 'Tarjeta Activa' : 'Tarjeta Inactiva'}
                                        </button>
                                        {(pacienteSeleccionadoData.recompensasDisponibles || 0) > 0 && (
                                            <button
                                                onClick={() => setModalRecompensaOpen(true)}
                                                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow"
                                            >
                                                Canjear ({pacienteSeleccionadoData.recompensasDisponibles})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Realizado por (Comisión)</label>
                            <select
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-1 focus:ring-turquesa outline-none bg-white text-gray-700 text-sm"
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                            >
                                <option value="">-- Sin asignar (Venta clínica/general) --</option>
                                {staffList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nombre} ({s.rol})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Servicio / Producto / Motivo</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Ej. Limpieza Facial, Crema Hidratante..."
                                    value={motivo}
                                    onChange={(e) => {
                                        setMotivo(e.target.value);
                                        setProductoSeleccionado(null);
                                        setMostrarSugerenciasProducto(e.target.value.length > 1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-1 focus:ring-turquesa outline-none"
                                />
                                {mostrarSugerenciasProducto && (productosFiltrados.length > 0 || serviciosFiltrados.length > 0) && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-20 mt-1 pb-1 max-h-60 overflow-y-auto">
                                        {productosFiltrados.length > 0 && (
                                            <>
                                                <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-400 uppercase rounded-t-xl">
                                                    Productos en Inventario
                                                </div>
                                                {productosFiltrados.map((prod) => (
                                                    <div
                                                        key={prod.id}
                                                        className="px-4 py-3 hover:bg-turquesa/5 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                                        onClick={() => seleccionarProducto(prod)}
                                                    >
                                                        <div>
                                                            <span className="font-medium text-gray-800 block">{prod.nombre}</span>
                                                            <span className="text-xs text-gray-500">Stock: {prod.stock || 0} pz</span>
                                                        </div>
                                                        <span className="font-bold text-turquesa">${prod.precio}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {serviciosFiltrados.length > 0 && (
                                            <>
                                                <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                                                    Servicios del Catálogo
                                                </div>
                                                {serviciosFiltrados.map((serv) => (
                                                    <div
                                                        key={serv.id}
                                                        className="px-4 py-3 hover:bg-turquesa/5 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                                        onClick={() => seleccionarServicio(serv)}
                                                    >
                                                        <div>
                                                            <span className="font-medium text-gray-800 block">{serv.nombre}</span>
                                                            <span className="text-xs text-gray-500">{serv.tipo}</span>
                                                        </div>
                                                        <span className="font-bold text-turquesa">${serv.precioVenta ?? serv.precio}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input
                                    label="Monto ($)"
                                    type="number"
                                    placeholder="0.00"
                                    icon={DollarSign}
                                    value={monto}
                                    onChange={(e) => setMonto(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="mb-1" onClick={handleAgregarItem}>
                                <PlusCircle size={16} className="mr-1" /> Agregar
                            </Button>
                        </div>

                        {listaItems.length > 0 && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase">Items en la cuenta:</p>
                                {listaItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{item.motivo}</p>
                                            <p className="text-xs text-gray-500">${item.monto.toLocaleString('es-MX')}</p>
                                        </div>
                                        <button onClick={() => handleEliminarItem(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-700">Total:</span>
                                    <span className="text-base font-black text-turquesa">
                                        ${listaItems.reduce((acc, item) => acc + item.monto, 0).toLocaleString('es-MX')}
                                    </span>
                                </div>
                            </div>
                        )}

                        <Input
                            label="Información de Paquete (Opcional)"
                            placeholder="Ej. Sesión 2 de 5 - Depilación Láser"
                            value={paqueteInfo}
                            onChange={(e) => setPaqueteInfo(e.target.value)}
                        />

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button
                                variant="outline"
                                icon={Banknote}
                                onClick={() => handleCobrar('Efectivo')}
                                disabled={saving}
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                                {saving ? '...' : 'Efectivo'}
                            </Button>
                            <Button
                                variant="primary"
                                icon={saving ? Loader : CreditCard}
                                onClick={() => handleCobrar('Tarjeta Débito/Crédito')}
                                disabled={saving}
                            >
                                {saving ? '...' : 'Tarjeta'}
                            </Button>
                            <Button
                                variant="secondary"
                                className="bg-acero text-white"
                                icon={ArrowRightLeft}
                                onClick={() => handleCobrar('Transferencia')}
                                disabled={saving}
                            >
                                {saving ? '...' : 'Transferencia'}
                            </Button>
                            <Button
                                variant="outline"
                                icon={Layers}
                                onClick={abrirPagoMixtoServicio}
                                disabled={saving}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                                Pago Mixto
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* 2. Abono a Planes de Tratamiento */}
                <Card title="2. Abonar a Planes de Tratamiento" className="border-t-4 border-t-acero bg-acero/5 shadow-sm">
                    <div className="space-y-4">
                        <div className="p-3.5 bg-white rounded-xl border border-acero/20">
                            <p className="text-xs text-acero uppercase font-bold tracking-wider mb-1">Impacto Automático</p>
                            <p className="text-xs text-gray-600">
                                Suma al progreso del paciente, genera su recibo digital y lo integra al Corte de Caja del día.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Paciente con Plan Activo</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar plan registrado..."
                                    value={pacienteAbono}
                                    onChange={(e) => {
                                        setPacienteAbono(e.target.value);
                                        setPlanSeleccionadoAbono(null);
                                        setMostrarSugerenciasPlan(e.target.value.length >= 1);
                                    }}
                                    className={`w-full pl-10 pr-4 py-2 rounded-xl border ${
                                        planSeleccionadoAbono ? 'border-green-400 bg-green-50' : 'border-gray-200'
                                    } focus:border-acero focus:ring-1 focus:ring-acero outline-none transition-colors bg-white`}
                                />
                                {mostrarSugerenciasPlan && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-20 mt-1 pb-1 text-sm max-h-60 overflow-y-auto">
                                        <div className="px-3 py-2 bg-acero/5 text-xs font-bold text-acero uppercase rounded-t-xl border-b border-gray-100 sticky top-0 bg-white">
                                            Planes de Tratamiento Activos
                                        </div>
                                        {planesList
                                            .filter((p) => p.activo !== false)
                                            .filter((p) => (p.paciente || '').toLowerCase().includes(pacienteAbono.toLowerCase()))
                                            .map((plan) => (
                                                <div
                                                    key={plan.id}
                                                    className="px-4 py-3 hover:bg-acero/5 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                                    onClick={() => {
                                                        setPacienteAbono(`${plan.paciente} - ${plan.objetivo}`);
                                                        setPlanSeleccionadoAbono(plan);
                                                        setMostrarSugerenciasPlan(false);
                                                    }}
                                                >
                                                    <div>
                                                        <span className="font-bold text-gray-800 block">{plan.paciente}</span>
                                                        <span className="text-xs text-gray-400 max-w-[150px] truncate block">{plan.objetivo}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-turquesa block">
                                                            Falta: ${((plan.meta || 0) - (plan.acumulado || 0)).toLocaleString('es-MX')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 block">
                                                            Total: ${(plan.meta || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Input
                            label="Monto del Abono ($)"
                            type="number"
                            placeholder="0.00"
                            icon={DollarSign}
                            value={montoAbono}
                            onChange={(e) => setMontoAbono(e.target.value)}
                        />

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button
                                variant="outline"
                                icon={Banknote}
                                onClick={() => handleRegistrarAbono('Efectivo')}
                                disabled={savingAbono}
                                className="bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                                {savingAbono ? '...' : 'Efectivo'}
                            </Button>
                            <Button
                                variant="primary"
                                icon={savingAbono ? Loader : CreditCard}
                                onClick={() => handleRegistrarAbono('Tarjeta Débito/Crédito')}
                                disabled={savingAbono}
                            >
                                {savingAbono ? '...' : 'Tarjeta'}
                            </Button>
                            <Button
                                variant="secondary"
                                className="bg-acero text-white"
                                icon={ArrowRightLeft}
                                onClick={() => handleRegistrarAbono('Transferencia')}
                                disabled={savingAbono}
                            >
                                {savingAbono ? '...' : 'Transferencia'}
                            </Button>
                            <Button
                                variant="outline"
                                icon={Layers}
                                onClick={abrirPagoMixtoAbono}
                                disabled={savingAbono}
                                className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                                Pago Mixto
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* 3. Registrar Gasto / Salida de Caja (Habilitado para Recepcionista y Admin con Categoría Obligatoria) */}
                <Card title="3. Registrar Gasto / Salida de Caja" className="border-t-4 border-t-rose-500 bg-rose-50/20 shadow-sm">
                    <div className="space-y-3.5">
                        <div className="p-3 bg-white rounded-xl border border-rose-200 flex items-start gap-2.5">
                            <Tag size={16} className="text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-600">
                                <strong className="text-rose-600">Regla Contable:</strong> Todo gasto registrado aquí lleva{' '}
                                <strong>categoría obligatoria</strong> y se descuenta automáticamente en el Corte de Caja del Administrador.
                            </p>
                        </div>

                        {/* Categoría Obligatoria */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">
                                Categoría Obligatoria del Gasto *
                            </label>
                            <select
                                value={categoriaGasto}
                                onChange={(e) => handleCambiarCategoriaGasto(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none bg-white text-sm font-bold text-gray-800"
                            >
                                {categoriasDisponibles.map((cat) => (
                                    <option key={cat.nombre} value={cat.nombre}>
                                        {cat.nombre} ({cat.grupo})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Motivo del Catálogo Ampliado */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">
                                    Motivo del Gasto (Catálogo) *
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setMostrarInputNuevoMotivo((v) => !v)}
                                    className="text-[11px] font-bold text-rose-600 hover:underline"
                                >
                                    {mostrarInputNuevoMotivo ? 'Cerrar' : '+ Nuevo motivo al catálogo'}
                                </button>
                            </div>
                            <select
                                value={motivoGastoCatalogo}
                                onChange={(e) => setMotivoGastoCatalogo(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-rose-500 outline-none bg-white text-sm text-gray-800"
                            >
                                {(categoriaSeleccionadaObj?.motivos || []).map((mot) => (
                                    <option key={mot} value={mot}>
                                        {mot}
                                    </option>
                                ))}
                            </select>

                            {mostrarInputNuevoMotivo && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nuevo motivo frecuente para esta categoría..."
                                        value={nuevoMotivoPersonalizado}
                                        onChange={(e) => setNuevoMotivoPersonalizado(e.target.value)}
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-rose-200 text-xs outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAgregarMotivoCatalogo}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Detalle específico y Proveedor/Nota */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Detalle / Especificación</label>
                                <input
                                    type="text"
                                    placeholder="Ej. 3 garrafones, marca..."
                                    value={detalleGastoExtra}
                                    onChange={(e) => setDetalleGastoExtra(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Proveedor / Folio Nota</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Bonafont #402"
                                    value={proveedorGasto}
                                    onChange={(e) => setProveedorGasto(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white"
                                />
                            </div>
                        </div>

                        {/* Monto y Origen del Pago */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Monto ($)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={montoGasto}
                                    onChange={(e) => setMontoGasto(e.target.value)}
                                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-base font-black text-rose-600 outline-none bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Pagado con</label>
                                <select
                                    value={origenGasto}
                                    onChange={(e) => setOrigenGasto(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 outline-none bg-white"
                                >
                                    <option value="Efectivo en Caja">Efectivo (Caja del Día)</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                    <option value="Tarjeta de Crédito/Débito">Tarjeta Clínica</option>
                                </select>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            icon={savingGasto ? Loader : ArrowDownCircle}
                            onClick={handleRegistrarGastoRecepcion}
                            disabled={savingGasto}
                            className="w-full bg-rose-600 border-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/10"
                        >
                            {savingGasto ? 'Registrando Gasto...' : 'Registrar Gasto en Corte del Día'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* ── Panel Inferior: Movimientos del Día y Alertas ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card
                        title={`Movimientos del Día (${fechaOperacion}) — ${movimientosFiltradosDia.length} registro(s)`}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                            <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
                                {['Todos', 'Ingreso', 'Egreso'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFiltroMovsDia(f)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            filtroMovsDia === f
                                                ? 'bg-white text-acero shadow-sm'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        {f === 'Todos' ? 'Todos' : f === 'Ingreso' ? 'Ingresos' : 'Gastos / Egresos'}
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                                Ingresos: <strong className="text-emerald-600">{formatMoney(resumenCajaDia.ingresosTotales)}</strong>
                                {' • '}
                                Gastos: <strong className="text-rose-600">{formatMoney(resumenCajaDia.egresosTotales)}</strong>
                            </div>
                        </div>

                        {movimientosFiltradosDia.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                No hay movimientos registrados en esta fecha.
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                {movimientosFiltradosDia.map((m, i) => {
                                    const catNorm = m.tipo === 'Egreso' ? normalizarCategoriaGasto(m) : m.categoria;
                                    return (
                                        <div
                                            key={m.id || i}
                                            className={`flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 ${
                                                m.estado === 'Cancelado' ? 'opacity-50 line-through' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`p-2 rounded-lg shrink-0 ${
                                                        m.tipo === 'Ingreso'
                                                            ? 'bg-emerald-100 text-emerald-600'
                                                            : 'bg-rose-100 text-rose-600'
                                                    }`}
                                                >
                                                    {m.tipo === 'Ingreso' ? <CheckCircle size={16} /> : <TrendingDown size={16} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-gray-800 truncate">
                                                            {m.motivo || m.concepto}
                                                        </p>
                                                        {catNorm && (
                                                            <span
                                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                                    m.tipo === 'Egreso'
                                                                        ? 'bg-rose-100 text-rose-700'
                                                                        : 'bg-teal-50 text-teal-700'
                                                                }`}
                                                            >
                                                                {catNorm}
                                                            </span>
                                                        )}
                                                        {m.estado === 'Pendiente Cancelación' && (
                                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">
                                                                Solicitud Cancelación
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        {m.metodoPago || m.tipo}
                                                        {m.pacienteNombre ? ` • Paciente: ${m.pacienteNombre}` : ''}
                                                        {m.proveedor ? ` • Prov: ${m.proveedor}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                                <span
                                                    className={`font-black text-base ${
                                                        m.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'
                                                    }`}
                                                >
                                                    {m.tipo === 'Ingreso' ? '+' : '−'}
                                                    {formatMoney(m.monto)}
                                                </span>
                                                {m.estado !== 'Cancelado' &&
                                                    m.estado !== 'Pendiente Cancelación' &&
                                                    (userRole === 'Recepcionista' || userRole === 'Administrador') && (
                                                        <button
                                                            title="Solicitar Cancelación"
                                                            onClick={() => handleSolicitarCancelacion(m.id)}
                                                            className="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100 transition-colors"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                <div>
                    <Card title="Alertas de Recepción" className="h-full border-turquesa/20">
                        <div className="space-y-3">
                            {/* Selector de Pestañas de Alertas */}
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setSubTabAlertas('checkin')}
                                    className={`flex-1 text-[11px] font-black uppercase tracking-wider py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        subTabAlertas === 'checkin'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Heart size={13} className="text-emerald-500" />
                                    Post-Consulta
                                    {alertasCheckinPost.filter(a => !a.atendido).length > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold">
                                            {alertasCheckinPost.filter(a => !a.atendido).length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSubTabAlertas('citas')}
                                    className={`flex-1 text-[11px] font-black uppercase tracking-wider py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        subTabAlertas === 'citas'
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Calendar size={13} className="text-turquesa" />
                                    Citas App
                                    {alertasCitasApp.length > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-turquesa text-white text-[9px] flex items-center justify-center font-bold">
                                            {alertasCitasApp.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSubTabAlertas('cumples')}
                                    className={`flex-1 text-[11px] font-black uppercase tracking-wider py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        subTabAlertas === 'cumples'
                                            ? 'bg-white text-acero shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Gift size={13} className="text-purple-500" />
                                    Cumples
                                    <span className="text-[10px] text-gray-400">({cumpleanosPacientes.length})</span>
                                </button>
                            </div>

                            {/* PESTAÑA 1: CHECK-IN POST-CONSULTA (CON BOTÓN DE WHATSAPP MOTIVACIONAL) */}
                            {subTabAlertas === 'checkin' && (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {alertasCheckinPost.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-6">Sin respuestas de check-in recientes.</p>
                                    ) : (
                                        alertasCheckinPost.map((alerta) => (
                                            <div
                                                key={alerta.id}
                                                className={`p-3 rounded-2xl border transition-all space-y-2 ${
                                                    alerta.atendido
                                                        ? 'bg-gray-50/70 border-gray-150 opacity-70'
                                                        : 'bg-emerald-50/60 border-emerald-200 shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm">
                                                                {alerta.estado === 'excelente' ? '🤩' : alerta.estado === 'duda' ? '🤔' : '🙂'}
                                                            </span>
                                                            <p className="text-xs font-black text-gray-900">{alerta.pacienteNombre}</p>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                                            Tel: <span className="font-bold">{alerta.pacienteTelefono || 'Sin teléfono'}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                        alerta.estado === 'excelente'
                                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                            : alerta.estado === 'duda'
                                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                            : 'bg-teal-100 text-teal-800 border-teal-300'
                                                    }`}>
                                                        {alerta.estado === 'excelente' ? 'Excelente' : alerta.estado === 'duda' ? 'Duda' : 'Bien / Normal'}
                                                    </span>
                                                </div>

                                                {alerta.nota && (
                                                    <p className="text-[11px] text-gray-600 bg-white/80 p-2 rounded-xl border border-gray-100 italic">
                                                        "{alerta.nota}"
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => enviarWhatsAppMotivador(alerta)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                                    >
                                                        <MessageSquare size={12} /> Enviar WhatsApp Motivador
                                                    </button>
                                                    {!alerta.atendido && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarcarAlertaAtendida(alerta.id)}
                                                            className="text-[10px] font-bold text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg bg-white border border-gray-200 cursor-pointer"
                                                        >
                                                            ✓ Listo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* PESTAÑA 2: CITAS AGENDADAS DESDE LA APP */}
                            {subTabAlertas === 'citas' && (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {alertasCitasApp.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-6">Sin citas auto-agendadas pendientes por revisar.</p>
                                    ) : (
                                        alertasCitasApp.map((cita) => (
                                            <div
                                                key={cita.id}
                                                className="p-3 bg-teal-50/60 border border-teal-200 rounded-2xl space-y-2 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-md">
                                                            App Paciente
                                                        </span>
                                                        <p className="text-xs font-black text-gray-900 mt-1">{cita.pacienteNombre}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-teal-800 bg-white px-2 py-1 rounded-lg border border-teal-200">
                                                        {cita.hora}
                                                    </span>
                                                </div>

                                                <div className="bg-white/80 p-2 rounded-xl border border-teal-100 text-[11px] space-y-0.5">
                                                    <p className="font-bold text-gray-800">{cita.servicio}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        Fecha: <strong className="text-gray-700">{cita.fecha}</strong> · Duración: <strong className="text-turquesa">{cita.duracionMin} min</strong>
                                                    </p>
                                                </div>

                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarcarAlertaAtendida(cita.id)}
                                                        className="px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-[10px] hover:bg-black transition-all cursor-pointer"
                                                    >
                                                        ✓ Enterada Recepción
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* PESTAÑA 3: CUMPLEAÑOS DEL MES / PRÓXIMOS 30 DÍAS */}
                            {subTabAlertas === 'cumples' && (
                                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                    {cumpleanosPacientes.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-6">Sin cumpleaños registrados en los próximos 30 días.</p>
                                    ) : (
                                        cumpleanosPacientes.map((c, i) => {
                                            const esHoy = c.detalleCumple?.esHoy;
                                            return (
                                                <div key={c.id || i} className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                                                    esHoy ? 'bg-amber-50/80 border-amber-300 shadow-sm' : 'bg-gray-50/80 border-gray-100 hover:border-amber-200'
                                                }`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded-lg ${
                                                                esHoy ? 'bg-amber-400 text-slate-900 animate-bounce' : 'bg-turquesa/10 text-turquesa'
                                                            }`}>
                                                                <Gift size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900 leading-tight">{c.nombre}</p>
                                                                <p className="text-[10px] text-gray-500">{c.telefono || 'Sin teléfono'}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            esHoy ? 'bg-amber-400 text-slate-950 font-black' : 'bg-turquesa text-white'
                                                        }`}>
                                                            {c.detalleCumple?.textoProximidad || 'Próximo'}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[10px] pt-1 border-t border-gray-100/80">
                                                        <span className="font-bold text-turquesa">
                                                            📅 {c.detalleCumple?.textoFechaExacta || c.fechaTexto}
                                                            {c.detalleCumple?.edadCumple ? ` (${c.detalleCumple.edadCumple} años)` : ''}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPacienteTarjetaModal(c)}
                                                            className="px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 text-[10px] font-black rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                                                            title="Diseñar tarjeta de regalo ALFRA"
                                                        >
                                                            <Sparkles size={11} /> 🎁 Tarjeta
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <p className="text-[10px] text-turquesa font-medium text-center pt-1">
                                        Aplica el <span className="font-bold">20% de descuento</span> o regalo especial en su visita.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* ── Modal: Pago Mixto / Dividido ────────────────────────────── */}
            {modalMixtoOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <h3 className="text-lg font-black text-acero flex items-center gap-2">
                            <Layers size={20} className="text-indigo-600" /> Pago Mixto / Dividido
                        </h3>
                        <p className="text-xs text-gray-500">
                            Divide el cobro entre Efectivo, Tarjeta y Transferencia. Cada monto impactará su método correspondiente en el Corte de Caja.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase">Monto en Efectivo ($)</label>
                                <input
                                    type="number"
                                    value={mixtoEfectivo}
                                    onChange={(e) => setMixtoEfectivo(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-emerald-200 rounded-xl text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-blue-700 uppercase">Monto con Tarjeta ($)</label>
                                <input
                                    type="number"
                                    value={mixtoTarjeta}
                                    onChange={(e) => setMixtoTarjeta(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-blue-200 rounded-xl text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-purple-700 uppercase">Monto por Transferencia ($)</label>
                                <input
                                    type="number"
                                    value={mixtoTransferencia}
                                    onChange={(e) => setMixtoTransferencia(e.target.value)}
                                    className="w-full mt-1 p-2.5 border border-purple-200 rounded-xl text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl flex justify-between items-center text-sm">
                            <span className="font-bold text-gray-600">Suma del desglose:</span>
                            <span className="font-black text-indigo-600">
                                {formatMoney((Number(mixtoEfectivo) || 0) + (Number(mixtoTarjeta) || 0) + (Number(mixtoTransferencia) || 0))}
                            </span>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalMixtoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button variant="primary" className="flex-1 bg-indigo-600 border-indigo-600" onClick={handleConfirmarPagoMixto}>
                                Confirmar Cobro Mixto
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Fondo Inicial de Caja y Retiros Parciales ────────── */}
            {modalFondoOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-lg font-black text-acero flex items-center gap-2">
                                <Wallet size={20} className="text-turquesa" /> Fondo de Apertura y Retiros ({fechaOperacion})
                            </h3>
                            <button onClick={() => setModalFondoOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">
                                Cerrar
                            </button>
                        </div>

                        {/* Fondo Inicial */}
                        <div className="p-4 bg-turquesa/5 border border-turquesa/20 rounded-xl space-y-3">
                            <label className="text-xs font-black text-acero uppercase block">
                                Fondo Fijo / Morralla Inicial en Cajón ($)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Ej. 1000"
                                    value={fondoInicialInput}
                                    onChange={(e) => setFondoInicialInput(e.target.value)}
                                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-base font-black bg-white"
                                />
                                <Button variant="primary" onClick={handleGuardarFondoInicial} disabled={savingCajaConfig}>
                                    Guardar Fondo
                                </Button>
                            </div>
                            <p className="text-[11px] text-gray-500">
                                Este monto se suma al efectivo cobrado del día para calcular el Efectivo Esperado en Cajón.
                            </p>
                        </div>

                        {/* Retiros Parciales / Sangrías */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-amber-700 uppercase">
                                Registrar Retiro Parcial de Efectivo / Entrega a Administración
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    placeholder="Monto retirado ($)"
                                    value={retiroMonto}
                                    onChange={(e) => setRetiroMonto(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold"
                                />
                                <input
                                    type="text"
                                    placeholder="Recibe (Ej. Administración)"
                                    value={retiroRecibe}
                                    onChange={(e) => setRetiroRecibe(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Motivo del retiro (Ej. Resguardo de efectivo medio día)"
                                    value={retiroConcepto}
                                    onChange={(e) => setRetiroConcepto(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleRegistrarRetiroParcial}
                                    disabled={savingCajaConfig}
                                    className="border-amber-400 text-amber-700 hover:bg-amber-50"
                                >
                                    + Registrar Retiro
                                </Button>
                            </div>

                            {resumenCajaDia.retiros.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <p className="text-xs font-bold text-gray-500">Retiros registrados hoy:</p>
                                    {resumenCajaDia.retiros.map((r) => (
                                        <div key={r.id} className="flex justify-between items-center p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-xs">
                                            <div>
                                                <span className="font-bold text-gray-800">{r.concepto}</span>
                                                <span className="text-gray-500 block">
                                                    Hora: {r.hora} • Recibió: {r.recibe}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-amber-700">{formatMoney(r.monto)}</span>
                                                <button onClick={() => handleEliminarRetiro(r.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Arqueo Físico de Caja (Billetes y Monedas) ───────── */}
            {modalArqueoOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-between items-start border-b pb-3">
                            <div>
                                <h3 className="text-xl font-black text-acero flex items-center gap-2">
                                    <Calculator size={22} className="text-turquesa" /> Arqueo Físico de Caja ({fechaOperacion})
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Cuenta los billetes y monedas en el cajón para cuadrar y entregar el turno al Administrador.
                                </p>
                            </div>
                            <button onClick={() => setModalArqueoOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">
                                ✕
                            </button>
                        </div>

                        {/* Fórmula de cuadre en vivo */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Efectivo Esperado</p>
                                <p className="text-base font-black text-slate-800">{formatMoney(resumenCajaDia.efectivoEsperadoEnCajon)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-turquesa uppercase">Contado Físico</p>
                                <p className="text-base font-black text-turquesa">{formatMoney(totalContadoArqueo)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Estado del Cuadre</p>
                                {Math.abs(diferenciaArqueoActual) < 0.5 ? (
                                    <p className="text-sm font-black text-emerald-600">✓ CUADRE EXACTO ($0.00)</p>
                                ) : diferenciaArqueoActual > 0 ? (
                                    <p className="text-sm font-black text-blue-600">
                                        SOBRANTE EN CAJA: +{formatMoney(diferenciaArqueoActual)}
                                    </p>
                                ) : (
                                    <p className="text-sm font-black text-rose-600">
                                        FALTANTE EN CAJA: {formatMoney(diferenciaArqueoActual)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Conteo por denominación */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {DENOMINACIONES_ARQUEO.map((d) => {
                                const cant = conteoDenominaciones[d.valor] ?? '';
                                const subtotal = (Number(cant) || 0) * d.valor;
                                return (
                                    <div key={d.valor} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/60 flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-gray-700">{d.label}</span>
                                            <span className="text-xs font-black text-emerald-700">{formatMoney(subtotal)}</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={cant}
                                            onChange={(e) =>
                                                setConteoDenominaciones((prev) => ({
                                                    ...prev,
                                                    [d.valor]: e.target.value,
                                                }))
                                            }
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-black text-center outline-none focus:border-turquesa"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
                                    Entregado por (Recepcionista)
                                </label>
                                <input
                                    type="text"
                                    value={entregadoPorNombre}
                                    onChange={(e) => setEntregadoPorNombre(e.target.value)}
                                    placeholder="Nombre de quien entrega caja"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
                                    Notas / Observaciones al Administrador
                                </label>
                                <input
                                    type="text"
                                    value={notasRecepcionCorte}
                                    onChange={(e) => setNotasRecepcionCorte(e.target.value)}
                                    placeholder="Ej. Se dejó $1,000 de fondo en cajón..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-3 border-t">
                            <Button variant="outline" className="flex-1" onClick={() => setModalArqueoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                icon={savingArqueo ? Loader : CheckCircle}
                                onClick={handleGuardarArqueoYEntregar}
                                disabled={savingArqueo}
                                className="flex-1 bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {savingArqueo ? 'Guardando...' : 'Guardar Arqueo y Entregar Corte'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Recompensa Lealtad ─────────────────────────────── */}
            {modalRecompensaOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl space-y-4">
                        <h3 className="text-lg font-bold text-acero">Canjear Recompensa de Lealtad</h3>
                        <p className="text-xs text-gray-500">
                            Especifica el beneficio o cortesía entregado a <strong>{pacienteNombre}</strong>.
                        </p>
                        <input
                            type="text"
                            placeholder="Ej. Facial Hidratante de Cortesía"
                            value={recompensaDetalle}
                            onChange={(e) => setRecompensaDetalle(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setModalRecompensaOpen(false)}>
                                Cancelar
                            </Button>
                            <Button variant="primary" onClick={handleCanjearRecompensa}>
                                Confirmar Canje
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Cancelación ────────────────────────────────────── */}
            {modalCancelacionOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Solicitar Cancelación</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Por favor, indica el motivo por el cual deseas cancelar este movimiento. El administrador deberá aprobarlo para que surta efecto en caja.
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Motivo de Cancelación</label>
                            <textarea
                                value={motivoCancelacion}
                                onChange={(e) => setMotivoCancelacion(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                                rows="3"
                                placeholder="Ej. Error en método de pago"
                            ></textarea>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <Button variant="outline" onClick={() => setModalCancelacionOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={confirmarCancelacion}
                            >
                                Enviar Solicitud
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Tarjeta de Cumpleaños ALFRA VIP */}
            {pacienteTarjetaModal && (
                <ModalTarjetaCumpleanos
                    isOpen={!!pacienteTarjetaModal}
                    onClose={() => setPacienteTarjetaModal(null)}
                    paciente={pacienteTarjetaModal}
                />
            )}

        </div>
    );
}
