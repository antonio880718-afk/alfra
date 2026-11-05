import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import ReciboNomina from '../../components/ui/ReciboNomina';
import {
    Users as UsersIcon, PlusCircle, Settings, ToggleRight, ToggleLeft,
    CheckCircle, Trash2, KeyRound, DollarSign, Banknote, ArrowRightLeft,
    Receipt, ChevronDown, List, Pencil, Check, X, Award, Camera, Phone,
    Calendar, CreditCard, Stethoscope, Copy, ExternalLink, ShieldCheck,
    UserCheck, Briefcase, AlertCircle, Eye, UploadCloud, MessageSquare, Download, PenTool, FileText
} from 'lucide-react';
import {
    onStaffChange, createEmpleado, updateEmpleado, deleteEmpleado, sincronizarBajasStaff,
    liquidarNomina, ajustarComisionManual, eliminarComisionHistorial,
    editarComisionHistorial, restablecerPasswordStaff
} from '../../services/staffService';
import { registrarMovimiento } from '../../services/finanzasService';
import { doc, setDoc, getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth, storage, firebaseConfig } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth, createUserWithEmailAndPassword, signOut,
    setPersistence, inMemoryPersistence
} from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';


const getRangoSemana = (offsetSemanas = 0) => {
    const ahora = new Date();
    ahora.setDate(ahora.getDate() + (offsetSemanas * 7));
    const dia = ahora.getDay();
    const diffLunes = (dia === 0 ? -6 : 1) - dia;
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() + diffLunes);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
        fechaInicio: toYMD(lunes),
        fechaFin: toYMD(domingo)
    };
};

const formatearTextoPeriodo = (inicioStr, finStr) => {
    if (!inicioStr || !finStr) return '';
    try {
        const [y1, m1, d1] = inicioStr.split('-').map(Number);
        const [y2, m2, d2] = finStr.split('-').map(Number);
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        if (y1 === y2 && m1 === m2) {
            return `Semana del ${d1} al ${d2} de ${meses[m1 - 1]} de ${y1}`;
        } else if (y1 === y2) {
            return `Semana del ${d1} de ${meses[m1 - 1]} al ${d2} de ${meses[m2 - 1]} de ${y1}`;
        } else {
            return `Semana del ${d1} de ${meses[m1 - 1]} de ${y1} al ${d2} de ${meses[m2 - 1]} de ${y2}`;
        }
    } catch (_) {
        return `Periodo del ${inicioStr} al ${finStr}`;
    }
};

const formatCurrency = (amount) => {
    const val = Number(amount);
    if (isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
};

export default function NominaView() {
    const { userRole } = useAuth();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [saving, setSaving] = useState(false);

    // Formulario de Empleado (con nuevos campos completos y foto)
    const initialFormData = {
        nombre: '',
        email: '',
        telefono: '',
        puesto: 'Doctor',
        nivelCosmetologa: '1',
        cedulaProfesional: '',
        fechaIngreso: new Date().toISOString().split('T')[0],
        fechaNacimiento: '',
        turno: 'Completo',
        contactoEmergenciaNombre: '',
        contactoEmergenciaTelefono: '',
        banco: 'BBVA',
        cuentaClabe: '',
        notas: '',
        foto: '',
        sueldoBase: '',
        comisionServicios: '',
        comisionProductos: ''
    };
    const [formData, setFormData] = useState(initialFormData);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const fileInputRef = useRef(null);

    // Estado para validación detallada y mensajes amigables
    const [formError, setFormError] = useState('');
    const [invalidFields, setInvalidFields] = useState([]);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (invalidFields.includes(field)) {
            setInvalidFields(prev => prev.filter(f => f !== field));
        }
        if (formError) setFormError('');
    };

    const [credenciales, setCredenciales] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [exitoAlta, setExitoAlta] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Modal de Ficha Rápida / Expediente del Empleado
    const [empleadoFicha, setEmpleadoFicha] = useState(null);
    const [empleadoResetModal, setEmpleadoResetModal] = useState(null);
    const [reseteandoPassword, setReseteandoPassword] = useState(false);
    const [resetExitoso, setResetExitoso] = useState(false);
    const [copiadoReset, setCopiadoReset] = useState(false);

    const handleEjecutarResetPassword = async () => {
        if (!empleadoResetModal) return;
        try {
            setReseteandoPassword(true);
            await restablecerPasswordStaff(empleadoResetModal.id, empleadoResetModal.email, 'Alfra2026!');
            setResetExitoso(true);
        } catch (err) {
            console.error(err);
            alert('Error al restablecer contraseña: ' + (err.message || 'Error desconocido'));
        } finally {
            setReseteandoPassword(false);
        }
    };

    // ── Liquidación de Nómina ─────────────────────────────────────────────
    const [empleadoLiquidar, setEmpleadoLiquidar] = useState(null);
    const [liquidandoId, setLiquidandoId] = useState(null);
    const rangoInicialSemana = getRangoSemana(0);
    const [nominaForm, setNominaForm] = useState({
        fechaInicio: rangoInicialSemana.fechaInicio,
        fechaFin: rangoInicialSemana.fechaFin,
        periodo: formatearTextoPeriodo(rangoInicialSemana.fechaInicio, rangoInicialSemana.fechaFin),
        metodoPago: 'Transferencia',
        sueldoBase: '',
        bonoPuntualidad: '',
        bonoProductividad: ''
    });

    const handleCambiarFechasPeriodo = (inicio, fin) => {
        const textoPeriodo = formatearTextoPeriodo(inicio, fin);
        setNominaForm(prev => ({
            ...prev,
            fechaInicio: inicio,
            fechaFin: fin,
            periodo: textoPeriodo
        }));
    };

    const aplicarRangoSemana = (offset = 0) => {
        const rango = getRangoSemana(offset);
        handleCambiarFechasPeriodo(rango.fechaInicio, rango.fechaFin);
    };
    const [reciboNominaOpen, setReciboNominaOpen] = useState(false);
    const [datosReciboNomina, setDatosReciboNomina] = useState(null);

    // ── Ajuste manual de comisiones ───────────────────────────────────────
    const [empleadoAjuste, setEmpleadoAjuste] = useState(null);
    const [formAjuste, setFormAjuste] = useState({ monto: '', motivo: '' });
    const [ajustando, setAjustando] = useState(false);

    // ── Detalle de historial de comisiones ────────────────────────────────
    const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
    const [editandoComision, setEditandoComision] = useState({ idx: null, monto: '' });

    // ── Bonos ──
    const [empleadoBonos, setEmpleadoBonos] = useState(null);
    const [formBonos, setFormBonos] = useState({ puntualidad: 0, productividad: 0 });

    useEffect(() => {
        // Sincronizar bajas historicas para asegurar revocacion en /usuarios
        sincronizarBajasStaff().catch(err => console.warn('Error sincronizando bajas staff:', err));

        const unsub = onStaffChange((data) => {
            setStaff(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // ── ACCIONES: WHATSAPP, SPEI, FIRMA Y CHECADOR GPS ──
    const [empleadoFirmaModal, setEmpleadoFirmaModal] = useState(null);
    const [guardandoFirma, setGuardandoFirma] = useState(false);
    const signatureCanvasRef = useRef(null);
    const isDrawingRef = useRef(false);
    const [retardosGpsPeriodo, setRetardosGpsPeriodo] = useState(null);

    const handleEnviarWhatsApp = (emp, datosPago = null) => {
        const tel = emp.telefono || emp.contactoEmergenciaTelefono || '';
        const cleanTel = tel.replace(/\D/g, '');
        const nombre = emp.nombre || 'Colaborador';
        const periodo = datosPago?.periodo || 'Periodo actual';
        const sueldo = formatCurrency(datosPago?.sueldoBase !== undefined ? datosPago.sueldoBase : (emp.sueldoBase || 0));
        const comisiones = formatCurrency(emp.saldoComisiones || 0);
        const bonoPunt = formatCurrency(datosPago?.bonoPuntualidad !== undefined ? datosPago.bonoPuntualidad : (emp.bonoPuntualidad || 0));
        const bonoProd = formatCurrency(datosPago?.bonoProductividad !== undefined ? datosPago.bonoProductividad : (emp.bonoProductividad || 0));
        const total = formatCurrency(
            (Number(datosPago?.sueldoBase !== undefined ? datosPago.sueldoBase : emp.sueldoBase) || 0) +
            (Number(emp.saldoComisiones) || 0) +
            (emp.usaBonos ? ((Number(datosPago?.bonoPuntualidad !== undefined ? datosPago.bonoPuntualidad : emp.bonoPuntualidad) || 0) + (Number(datosPago?.bonoProductividad !== undefined ? datosPago.bonoProductividad : emp.bonoProductividad) || 0)) : 0)
        );

        const mensaje = `*CLÍNICA ALFRA - Recibo de Nómina*\n\n` +
            `Hola *${nombre}*, te compartimos el resumen de tu liquidación de nómina:\n\n` +
            `📅 *Periodo:* ${periodo}\n` +
            `👤 *Puesto:* ${emp.puesto || emp.rol}\n` +
            `💵 *Sueldo Base:* ${sueldo}\n` +
            `✨ *Comisiones:* ${comisiones}\n` +
            (emp.usaBonos ? `🎁 *Bono Puntualidad:* ${bonoPunt}\n🎁 *Bono Productividad:* ${bonoProd}\n` : '') +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 *TOTAL A COBRAR:* ${total}\n\n` +
            `_Clínica ALFRA - Gracias por tu excelente dedicación._`;

        const url = cleanTel
            ? `https://api.whatsapp.com/send?phone=52${cleanTel.length === 10 ? cleanTel : cleanTel.slice(-10)}&text=${encodeURIComponent(mensaje)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    };

    const handleExportarDispersionBancaria = () => {
        if (!staff || staff.length === 0) {
            alert('No hay colaboradores registrados para dispersión.');
            return;
        }
        const rows = staff.map(emp => {
            const monto = (Number(emp.sueldoBase) || 0) + (Number(emp.saldoComisiones) || 0) +
                (emp.usaBonos ? ((Number(emp.bonoPuntualidad) || 0) + (Number(emp.bonoProductividad) || 0)) : 0);
            const clabe = (emp.cuentaClabe || emp.datosBancarios?.clabe || '').trim();
            const banco = emp.banco || emp.datosBancarios?.banco || 'BBVA';
            return [
                `"${emp.nombre || ''}"`,
                `"${banco}"`,
                `"${clabe || 'PENDIENTE'}"`,
                monto.toFixed(2),
                `"PAGO NOMINA ALFRA ${new Date().toLocaleDateString('es-MX')}"`,
                `"${emp.puesto || emp.rol || ''}"`
            ];
        });
        const headers = ['Nombre Colaborador', 'Institución Bancaria', 'Cuenta CLABE (18 dígitos)', 'Monto a Pagar (MXN)', 'Concepto / Referencia', 'Puesto'];
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Layout_Dispersion_Bancaria_ALFRA_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCanvasCoordinates = (e) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        isDrawingRef.current = true;
    };

    const draw = (e) => {
        if (!isDrawingRef.current) return;
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        isDrawingRef.current = false;
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const saveSignature = async () => {
        if (!empleadoFirmaModal || !signatureCanvasRef.current) return;
        setGuardandoFirma(true);
        try {
            const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
            await updateEmpleado(empleadoFirmaModal.id, {
                ultimaFirmaNomina: {
                    dataUrl,
                    fecha: new Date().toISOString()
                }
            });
            alert('? Firma de conformidad registrada exitosamente.');
            setEmpleadoFirmaModal(null);
        } catch (err) {
            alert('Error al guardar firma: ' + err.message);
        } finally {
            setGuardandoFirma(false);
        }
    };

    useEffect(() => {
        if (!empleadoLiquidar) {
            setRetardosGpsPeriodo(null);
            return;
        }
        const checkAsistencia = async () => {
            try {
                const asistenciaCol = collection(db, 'asistencia');
                const q = query(
                    asistenciaCol,
                    where('nombre', '==', empleadoLiquidar.nombre)
                );
                const snap = await getDocs(q);
                if (snap.empty) {
                    setRetardosGpsPeriodo(0);
                    return;
                }
                const fInicio = nominaForm.fechaInicio || '2000-01-01';
                const fFin = nominaForm.fechaFin || '2099-12-31';
                let retardos = 0;
                snap.forEach(d => {
                    const data = d.data();
                    if (data.fechaYMD >= fInicio && data.fechaYMD <= fFin) {
                        if (data.estado === 'Retardo' || (data.demeritoMin && data.demeritoMin > 0)) {
                            retardos++;
                        }
                    }
                });
                setRetardosGpsPeriodo(retardos);
            } catch (e) {
                console.warn('Error auditando asistencia GPS:', e);
                setRetardosGpsPeriodo(0);
            }
        };
        checkAsistencia();
    }, [empleadoLiquidar, nominaForm.fechaInicio, nominaForm.fechaFin]);


    // Compresión y carga de foto de perfil del colaborador
    const handleSubirFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSubiendoFoto(true);
        try {
            // Compresión canvas
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

                    canvas.toBlob(async (blob) => {
                        const timestamp = Date.now();
                        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'foto.jpg';
                        const storagePath = `staff_fotos/${timestamp}_${safeName}`;

                        try {
                            const storageRef = ref(storage, storagePath);
                            await uploadBytes(storageRef, blob);
                            const downloadUrl = await getDownloadURL(storageRef);
                            setFormData(prev => ({ ...prev, foto: downloadUrl }));
                        } catch (err) {
                            console.warn('Storage falló, usando dataUrl de respaldo:', err);
                            setFormData(prev => ({ ...prev, foto: dataUrl }));
                        } finally {
                            setSubiendoFoto(false);
                        }
                    }, 'image/jpeg', 0.82);
                };
            };
        } catch (err) {
            console.error('Error al procesar foto:', err);
            alert('Error al cargar imagen');
            setSubiendoFoto(false);
        }
    };

    const handleToggleComisiones = async (id, current) => {
        try {
            await updateEmpleado(id, { usaComisiones: !current });
        } catch (err) { console.error(err); }
    };

    const handleLiquidar = async (metodo) => {
        if (!empleadoLiquidar) return;
        setLiquidandoId(empleadoLiquidar.id);
        try {
            const pago = await liquidarNomina(empleadoLiquidar.id, {
                periodo: nominaForm.periodo,
                metodoPago: metodo,
                sueldoBase: Number(nominaForm.sueldoBase) || 0,
                bonoPuntualidad: empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoPuntualidad) || 0) : 0,
                bonoProductividad: empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoProductividad) || 0) : 0
            });

            // Registrar el egreso en finanzas
            await registrarMovimiento({
                tipo: 'Egreso',
                monto: pago.totalNeto,
                motivo: `Nómina ${pago.empleadoNombre} — ${pago.periodo}`,
                categoria: 'Nómina',
                metodoPago: metodo,
                staffId: empleadoLiquidar.id,
                staffNombre: pago.empleadoNombre,
                folioNomina: pago.folio,
                fecha: new Date().toISOString(),
            });

            // Mostrar recibo
            setDatosReciboNomina(pago);
            setReciboNominaOpen(true);
            setEmpleadoLiquidar(null);
        } catch (err) {
            alert('Error al liquidar nómina: ' + (err.message || 'Intenta de nuevo.'));
            console.error(err);
        } finally {
            setLiquidandoId(null);
        }
    };

    const handleAjustar = async () => {
        if (!empleadoAjuste || !formAjuste.monto) {
            alert('Por favor ingresa un monto.');
            return;
        }
        setAjustando(true);
        try {
            await ajustarComisionManual(empleadoAjuste.id, formAjuste.monto, formAjuste.motivo);
            setEmpleadoAjuste(null);
        } catch (error) {
            alert('Error al ajustar el saldo.');
            console.error(error);
        } finally {
            setAjustando(false);
        }
    };

    const handleEliminarComision = async (originalIdx) => {
        if (!window.confirm('¿Eliminar este registro de comisión? El monto se restará de su saldo acumulado.')) return;
        try {
            await eliminarComisionHistorial(empleadoDetalle.id, originalIdx);
            const nuevoHistorial = [...empleadoDetalle.historialComisiones];
            const comisionRemovida = nuevoHistorial.splice(originalIdx, 1)[0];
            const nuevoSaldo = Math.max(0, empleadoDetalle.saldoComisiones - (comisionRemovida.comisionGanada || 0));
            setEmpleadoDetalle({ ...empleadoDetalle, historialComisiones: nuevoHistorial, saldoComisiones: nuevoSaldo });
            setEditandoComision({ idx: null, monto: '' });
        } catch (error) {
            console.error(error);
            alert('Error al eliminar comisión');
        }
    };

    const handleGuardarEdicion = async (originalIdx) => {
        if (!editandoComision.monto || isNaN(editandoComision.monto)) {
            alert('Ingresa un monto válido.');
            return;
        }
        try {
            const { nuevoSaldo, nuevoHistorial } = await editarComisionHistorial(empleadoDetalle.id, originalIdx, editandoComision.monto);
            setEmpleadoDetalle({ ...empleadoDetalle, historialComisiones: nuevoHistorial, saldoComisiones: nuevoSaldo });
            setEditandoComision({ idx: null, monto: '' });
        } catch (error) {
            console.error(error);
            alert('Error al editar comisión');
        }
    };

    const handleToggleBonos = async (id, currentStatus) => {
        try {
            await updateEmpleado(id, { usaBonos: !currentStatus });
        } catch (error) {
            console.error(error);
            alert('Error al actualizar el estado de bonos');
        }
    };

    const handleToggleAutoAgendado = async (id, currentStatus) => {
        try {
            const nextStatus = currentStatus === false ? true : false;
            await updateEmpleado(id, { disponibleAutoAgendado: nextStatus });
        } catch (error) {
            console.error(error);
            alert('Error al actualizar disponibilidad de auto-agendado');
        }
    };

    const handleGuardarBonos = async () => {
        try {
            await updateEmpleado(empleadoBonos.id, {
                bonoPuntualidad: Number(formBonos.puntualidad) || 0,
                bonoProductividad: Number(formBonos.productividad) || 0
            });
            setEmpleadoBonos(null);
        } catch (error) {
            console.error('Error al guardar bonos:', error);
            alert('Error al guardar bonos');
        }
    };

    const handleOpenModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee.id);
            const isCosme = (employee.puesto || '').includes('Cosmetóloga');
            setFormData({
                nombre: employee.nombre || '',
                email: employee.email || '',
                telefono: employee.telefono || '',
                puesto: isCosme ? 'Cosmetóloga' : employee.puesto || 'Doctor',
                nivelCosmetologa: isCosme ? (employee.puesto || '').split(' - ')[1]?.replace('Nivel ', '') || '1' : '1',
                cedulaProfesional: employee.cedulaProfesional || '',
                fechaIngreso: employee.fechaIngreso || new Date().toISOString().split('T')[0],
                fechaNacimiento: employee.fechaNacimiento || '',
                turno: employee.turno || 'Completo',
                contactoEmergenciaNombre: employee.contactoEmergenciaNombre || '',
                contactoEmergenciaTelefono: employee.contactoEmergenciaTelefono || '',
                banco: employee.banco || 'BBVA',
                cuentaClabe: employee.cuentaClabe || '',
                notas: employee.notas || '',
                foto: employee.foto || employee.fotoUrl || '',
                sueldoBase: employee.sueldoBase || '',
                comisionServicios: employee.comisionServicios || '',
                comisionProductos: employee.comisionProductos || ''
            });
        } else {
            setEditingEmployee(null);
            setFormData(initialFormData);
            setCredenciales(null);
            setExitoAlta(false);
        }
        setFormError('');
        setInvalidFields([]);
        setIsModalOpen(true);
    };

    const handleSaveEmployee = async () => {
        setFormError('');
        setInvalidFields([]);

        const missing = [];
        const invalid = [];

        const nombreLimpio = (formData.nombre || '').trim();
        const emailLimpio = (formData.email || '').trim().toLowerCase();

        // 1. Validaciones de formulario con señalamiento exacto del campo
        if (!nombreLimpio) {
            missing.push('• Nombre Completo del colaborador');
            invalid.push('nombre');
        }

        if (!editingEmployee) {
            if (!emailLimpio) {
                missing.push('• Correo Electrónico (obligatorio para crear el acceso)');
                invalid.push('email');
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailLimpio)) {
                    missing.push('• Formato de Correo Electrónico inválido (ejemplo: doctor@alfra.com)');
                    invalid.push('email');
                }
            }
        }

        if (!formData.puesto) {
            missing.push('• Puesto / Rol en Clínica');
            invalid.push('puesto');
        }

        if (formData.sueldoBase !== '' && Number(formData.sueldoBase) < 0) {
            missing.push('• El Sueldo Base no puede ser negativo');
            invalid.push('sueldoBase');
        }

        if (missing.length > 0) {
            const errorMsg = 'Para continuar, completa los datos requeridos:\n' + missing.join('\n');
            setFormError(errorMsg);
            setInvalidFields(invalid);
            return;
        }

        setSaving(true);
        const puestoFinal = formData.puesto === 'Cosmetóloga' ? `Cosmetóloga - Nivel ${formData.nivelCosmetologa}` : formData.puesto;

        try {
            let uid = null;
            let generatedPassword = null;

            if (!editingEmployee) {
                generatedPassword = `Alfra2026!`;

                // Instancia secundaria independiente para crear usuario sin desloguear al admin
                const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
                const secondaryAuth = getAuth(secondaryApp);
                const secondaryDb = getFirestore(secondaryApp);
                await setPersistence(secondaryAuth, inMemoryPersistence);

                try {
                    const userCredential = await createUserWithEmailAndPassword(
                        secondaryAuth,
                        emailLimpio,
                        generatedPassword
                    );
                    uid = userCredential.user.uid;

                    let roleAsignado = 'Especialista';
                    if (formData.puesto === 'Doctor') roleAsignado = 'Doctor';
                    else if (formData.puesto === 'Administrador') roleAsignado = 'Administrador';
                    else if (formData.puesto === 'Recepcionista') roleAsignado = 'Recepcionista';
                    else if (formData.puesto === 'Limpieza' || formData.puesto === 'Intendencia') roleAsignado = 'Limpieza';

                    const userDoc = {
                        uid,
                        email: emailLimpio,
                        nombre: nombreLimpio,
                        role: roleAsignado,
                        createdAt: new Date().toISOString(),
                    };

                    // Guardar perfil de usuario mientras secondaryAuth está activo (cumple la regla isOwner)
                    try {
                        await setDoc(doc(secondaryDb, 'usuarios', uid), userDoc);
                    } catch (secDbErr) {
                        console.warn("setDoc con secondaryDb falló, intentando con db principal:", secDbErr);
                        try {
                            await setDoc(doc(db, 'usuarios', uid), userDoc);
                        } catch (primDbErr) {
                            console.error("Error al registrar en /usuarios:", primDbErr);
                        }
                    }

                    await signOut(secondaryAuth);
                    await deleteApp(secondaryApp);

                    setCredenciales({ email: emailLimpio, password: generatedPassword });
                } catch (authError) {
                    try { await deleteApp(secondaryApp); } catch (e) { /* ignore */ }
                    throw authError;
                }
            }

            const empleadoData = {
                nombre: nombreLimpio,
                email: emailLimpio,
                telefono: formData.telefono?.trim() || '',
                puesto: puestoFinal,
                cedulaProfesional: formData.cedulaProfesional?.trim() || '',
                fechaIngreso: formData.fechaIngreso || new Date().toISOString().split('T')[0],
                fechaNacimiento: formData.fechaNacimiento || '',
                turno: formData.turno || 'Completo',
                contactoEmergenciaNombre: formData.contactoEmergenciaNombre?.trim() || '',
                contactoEmergenciaTelefono: formData.contactoEmergenciaTelefono?.trim() || '',
                banco: formData.banco?.trim() || '',
                cuentaClabe: formData.cuentaClabe?.trim() || '',
                notas: formData.notas?.trim() || '',
                foto: formData.foto || '',
                fotoUrl: formData.foto || '',
                sueldoBase: formData.sueldoBase === '' ? 0 : (Number(formData.sueldoBase) || 0),
                comisionServicios: Number(formData.comisionServicios) || 0,
                comisionProductos: Number(formData.comisionProductos) || 0,
                usaComisiones: editingEmployee ? (staff.find(s => s.id === editingEmployee)?.usaComisiones ?? true) : true,
                uid: editingEmployee ? (staff.find(s => s.id === editingEmployee)?.uid || null) : (uid || null),
                estatus: editingEmployee ? (staff.find(s => s.id === editingEmployee)?.estatus || 'Activo') : 'Activo',
            };

            if (editingEmployee) {
                await updateEmpleado(editingEmployee, empleadoData);
                setIsModalOpen(false);
            } else {
                await createEmpleado(empleadoData);
                setExitoAlta(true);
            }
        } catch (err) {
            console.error("Detalle del error al dar de alta:", err);
            let msg = err.message || 'Error inesperado al registrar el colaborador.';

            if (err.code === 'auth/email-already-in-use') {
                msg = `El correo "${emailLimpio}" ya está registrado en Firebase con otra cuenta. Usa un correo distinto o edita el perfil existente.`;
            } else if (err.code === 'auth/invalid-email') {
                msg = `El formato del correo "${emailLimpio}" es inválido.`;
            } else if (err.code === 'auth/weak-password') {
                msg = 'La contraseña temporal no cumple los requisitos mínimos de seguridad.';
            } else if (err.code === 'auth/network-request-failed') {
                msg = 'Error de conexión a internet con Firebase. Revisa tu red.';
            } else if (err.code === 'permission-denied') {
                msg = 'Permiso denegado por la base de datos Firestore al guardar el registro. Verifica los permisos de tu cuenta.';
            }

            setFormError(msg);
            alert('Atención al dar de alta: ' + msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStaff = async () => {
        if (!employeeToDelete) return;
        setConfirmingDelete(true);
        try {
            await deleteEmpleado(employeeToDelete.id, employeeToDelete);
            setEmployeeToDelete(null);
            alert(`Colaborador ${employeeToDelete.nombre || ''} dado de baja exitosamente. Sus credenciales y accesos al sistema han sido revocados por completo.`);
        } catch (err) {
            console.error(err);
            alert('Error al dar de baja al empleado: ' + (err.message || ''));
        } finally {
            setConfirmingDelete(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    // Calcular antigüedad amigable
    const calcularAntiguedad = (fechaIngreso) => {
        if (!fechaIngreso) return 'No especificada';
        const inicio = new Date(fechaIngreso);
        const hoy = new Date();
        const diffMeses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
        if (diffMeses < 1) return 'Nuevo ingreso (menos de 1 mes)';
        const anios = Math.floor(diffMeses / 12);
        const meses = diffMeses % 12;
        let res = '';
        if (anios > 0) res += `${anios} año${anios > 1 ? 's' : ''} `;
        if (meses > 0) res += `${meses} mes${meses > 1 ? 'es' : ''}`;
        return res.trim() || '1 mes';
    };

    return (
        <div className="space-y-6">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-acero flex items-center gap-2">
                        <UsersIcon className="text-turquesa" size={28} /> Nómina y Personal ALFRA
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Expediente de colaboradores con foto, datos bancarios, comisiones y sueldos.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExportarDispersionBancaria}
                        className="px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition flex items-center gap-2 shadow-sm"
                        title="Exportar archivo CSV para dispersión bancaria masiva (SPEI / BBVA / Santander)"
                    >
                        <Download size={16} />
                        <span>Dispersión Bancaria (SPEI)</span>
                    </button>
                    <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenModal()}>
                        Dar de Alta Personal
                    </Button>
                </div>
            </div>

            {/* TABLA PRINCIPAL DE PERSONAL */}
            <Card className="p-0 overflow-hidden shadow-sm border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b">
                                <th className="p-4">Colaborador / Foto</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4">Sueldo Base</th>
                                <th className="p-4">C. Servicios</th>
                                <th className="p-4">C. Productos</th>
                                <th className="p-4 text-turquesa">Saldo Comisiones</th>
                                <th className="p-4 text-center">Bonos</th>
                                <th className="p-4 text-center">Activar Com.</th>
                                <th className="p-4 text-center">Auto-Agendado App</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="10" className="p-10 text-center text-gray-400">Cargando personal...</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan="10" className="p-10 text-center text-gray-400">No hay personal registrado</td></tr>
                            ) : (
                                staff.map((empleado) => {
                                    const esDoctor = (empleado.puesto || '').toLowerCase().includes('doctor');
                                    const esEspecialista = (empleado.puesto || '').toLowerCase().includes('especialista');

                                    return (
                                        <tr key={empleado.id} className="hover:bg-gray-50/50 transition-colors">
                                            {/* COLABORADOR CON FOTO Y ROL */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        onClick={() => setEmpleadoFicha(empleado)}
                                                        className="w-11 h-11 rounded-full overflow-hidden border-2 border-turquesa/40 bg-slate-100 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform flex-shrink-0 shadow-sm"
                                                        title="Ver ficha completa"
                                                    >
                                                        {(empleado.foto || empleado.fotoUrl) ? (
                                                            <img src={empleado.foto || empleado.fotoUrl} alt={empleado.nombre} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="font-black text-turquesa text-sm">
                                                                {empleado.nombre?.slice(0, 2).toUpperCase() || 'AL'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div 
                                                            onClick={() => setEmpleadoFicha(empleado)}
                                                            className="font-bold text-acero hover:text-turquesa cursor-pointer transition-colors flex items-center gap-1.5"
                                                        >
                                                            {empleado.nombre}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                                                esDoctor 
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                    : esEspecialista
                                                                        ? 'bg-turquesa/15 text-turquesa border border-turquesa/30'
                                                                        : 'bg-slate-100 text-slate-700'
                                                            }`}>
                                                                {esDoctor ? '🩺 ' : ''}{empleado.puesto}
                                                            </span>
                                                            {empleado.cedulaProfesional && (
                                                                <span className="text-[9px] text-gray-400 font-mono">
                                                                    Ced: {empleado.cedulaProfesional}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CONTACTO */}
                                            <td className="p-4 text-xs text-slate-600">
                                                {empleado.telefono ? (
                                                    <a 
                                                        href={`https://wa.me/52${empleado.telefono.replace(/\D/g, '')}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200"
                                                    >
                                                        <Phone size={12} /> {empleado.telefono}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 italic">Sin teléfono</span>
                                                )}
                                                <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[140px]">{empleado.email}</div>
                                            </td>

                                            {/* SUELDO BASE */}
                                            <td className="p-4 font-mono text-sm">{formatCurrency(empleado.sueldoBase)}</td>

                                            {/* COMISIÓN SERVICIOS (INTACTO) */}
                                            <td className="p-4 font-bold text-acero/60 text-sm">{empleado.comisionServicios || 0}%</td>

                                            {/* COMISIÓN PRODUCTOS (INTACTO) */}
                                            <td className="p-4 font-bold text-acero/60 text-sm">{empleado.comisionProductos || 0}%</td>

                                            {/* SALDO DE COMISIONES (INTACTO) */}
                                            <td className="p-4 font-black text-turquesa lg:text-lg">{formatCurrency(empleado.saldoComisiones || 0)}</td>

                                            {/* BONOS TOGGLE (INTACTO) */}
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleToggleBonos(empleado.id, empleado.usaBonos)} className="transition-transform active:scale-95">
                                                        {empleado.usaBonos ? <ToggleRight className="text-indigo-500" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                                                    </button>
                                                    {empleado.usaBonos && (
                                                        <button 
                                                            title="Configurar Bonos"
                                                            onClick={() => {
                                                                setEmpleadoBonos(empleado);
                                                                setFormBonos({ 
                                                                    puntualidad: empleado.bonoPuntualidad || 0, 
                                                                    productividad: empleado.bonoProductividad || 0 
                                                                });
                                                            }}
                                                            className="inline-flex items-center justify-center p-1 rounded-full text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                        >
                                                            <Award size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* SWITCH COMISIONES (INTACTO) */}
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleToggleComisiones(empleado.id, empleado.usaComisiones)} className="transition-transform active:scale-95">
                                                    {empleado.usaComisiones ? <ToggleRight className="text-turquesa" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                                                </button>
                                            </td>

                                            {/* SWITCH AUTO-AGENDADO EN APP DE PACIENTES */}
                                            <td className="p-4 text-center">
                                                {(() => {
                                                    const pNorm = String(empleado.puesto || empleado.rol || '').toLowerCase();
                                                    const esNoClinico = pNorm.includes('admin') || pNorm.includes('recep') || pNorm.includes('limpieza') || pNorm.includes('intendencia');
                                                    if (esNoClinico) {
                                                        return <span className="text-[10px] text-gray-400 italic">No aplica</span>;
                                                    }
                                                    const activoEnApp = empleado.disponibleAutoAgendado !== false;
                                                    return (
                                                        <div className="flex flex-col items-center justify-center">
                                                            <button
                                                                type="button"
                                                                title={activoEnApp ? 'Disponible para auto-agendado de pacientes (Clic para desactivar)' : 'Oculta en auto-agendado de pacientes (Clic para activar)'}
                                                                onClick={() => handleToggleAutoAgendado(empleado.id, empleado.disponibleAutoAgendado)}
                                                                className="transition-transform active:scale-95 cursor-pointer"
                                                            >
                                                                {activoEnApp ? (
                                                                    <ToggleRight className="text-emerald-500" size={32} />
                                                                ) : (
                                                                    <ToggleLeft className="text-gray-300" size={32} />
                                                                )}
                                                            </button>
                                                            <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${activoEnApp ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                {activoEnApp ? 'Visible en App' : 'Pausada en App'}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* ACCIONES */}
                                            <td className="p-4">
                                                <div className="flex justify-center gap-1 flex-wrap">
                                                    <button
                                                        title="Enviar Recibo de Nómina por WhatsApp"
                                                        onClick={() => handleEnviarWhatsApp(empleado)}
                                                        className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                    <button
                                                        title="Firma Digital de Conformidad"
                                                        onClick={() => setEmpleadoFirmaModal(empleado)}
                                                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <PenTool size={18} />
                                                    </button>
                                                    <button
                                                        title="Ver Ficha / Expediente del Colaborador"
                                                        onClick={() => setEmpleadoFicha(empleado)}
                                                        className="p-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        title="Ver Detalle de Comisiones"
                                                        onClick={() => setEmpleadoDetalle(empleado)}
                                                        className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        <List size={18} />
                                                    </button>
                                                    {userRole === 'Administrador' && (
                                                        <button
                                                            title="Ajuste Manual de Comisión"
                                                            onClick={() => {
                                                                setEmpleadoAjuste(empleado);
                                                                setFormAjuste({ monto: '', motivo: '' });
                                                            }}
                                                            className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                        >
                                                            <DollarSign size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        title="Liquidar Nómina"
                                                        onClick={() => {
                                                            const rango = getRangoSemana(0);
                                                            setEmpleadoLiquidar(empleado);
                                                            setNominaForm({
                                                                fechaInicio: rango.fechaInicio,
                                                                fechaFin: rango.fechaFin,
                                                                periodo: formatearTextoPeriodo(rango.fechaInicio, rango.fechaFin),
                                                                metodoPago: 'Transferencia',
                                                                sueldoBase: empleado.sueldoBase || '',
                                                                bonoPuntualidad: empleado.bonoPuntualidad || 0,
                                                                bonoProductividad: empleado.bonoProductividad || 0
                                                            });
                                                        }}
                                                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    >
                                                        <Receipt size={18} />
                                                    </button>
                                                    {userRole === 'Administrador' && (
                                                        <button
                                                            title="Restablecer Contraseña (Alfra2026!)"
                                                            onClick={() => {
                                                                setEmpleadoResetModal(empleado);
                                                                setResetExitoso(false);
                                                                setCopiadoReset(false);
                                                            }}
                                                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                                                        >
                                                            <KeyRound size={18} />
                                                        </button>
                                                    )}
                                                    <Button variant="ghost" size="sm" icon={Settings} onClick={() => handleOpenModal(empleado)} className="hover:bg-acero/5" />
                                                    <button onClick={() => setEmployeeToDelete(empleado)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ═══ MODAL FICHA DEL COLABORADOR (TIPO CREDENCIAL / EXPEDIENTE) ═══ */}
            {empleadoFicha && (
                <Modal
                    isOpen={!!empleadoFicha}
                    onClose={() => setEmpleadoFicha(null)}
                    title="Ficha del Colaborador · Clínica ALFRA"
                    maxWidth="max-w-xl"
                >
                    <div className="space-y-6">
                        {/* HERO DE LA FICHA */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl text-white flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-turquesa bg-slate-700 flex items-center justify-center flex-shrink-0 shadow-xl">
                                {(empleadoFicha.foto || empleadoFicha.fotoUrl) ? (
                                    <img src={empleadoFicha.foto || empleadoFicha.fotoUrl} alt={empleadoFicha.nombre} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-black text-2xl text-turquesa">
                                        {empleadoFicha.nombre?.slice(0, 2).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="text-center sm:text-left flex-1">
                                <span className="inline-block px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-turquesa/20 text-teal-300 mb-1 border border-teal-500/30">
                                    {empleadoFicha.puesto}
                                </span>
                                <h3 className="text-xl font-black text-white">{empleadoFicha.nombre}</h3>
                                <p className="text-xs text-slate-300 mt-0.5">{empleadoFicha.email}</p>
                                {empleadoFicha.cedulaProfesional && (
                                    <p className="text-xs text-teal-400 font-mono mt-1">Cédula: {empleadoFicha.cedulaProfesional}</p>
                                )}
                            </div>
                        </div>

                        {/* DETALLE EN TARJETAS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            {/* Contacto & Personal */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                                <h4 className="font-black text-slate-700 flex items-center gap-1.5 uppercase text-[11px]">
                                    <Phone size={14} className="text-teal-600" /> Contacto Personal
                                </h4>
                                <p><strong>Teléfono / WhatsApp:</strong> {empleadoFicha.telefono || 'No registrado'}</p>
                                <p><strong>Cumpleaños:</strong> {empleadoFicha.fechaNacimiento || 'No registrado'}</p>
                                <p><strong>Contacto Emergencia:</strong> {empleadoFicha.contactoEmergenciaNombre || 'No asignado'} {empleadoFicha.contactoEmergenciaTelefono ? `(${empleadoFicha.contactoEmergenciaTelefono})` : ''}</p>
                            </div>

                            {/* Datos Laborales */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                                <h4 className="font-black text-slate-700 flex items-center gap-1.5 uppercase text-[11px]">
                                    <Briefcase size={14} className="text-teal-600" /> Datos Laborales
                                </h4>
                                <p><strong>Fecha Ingreso:</strong> {empleadoFicha.fechaIngreso || 'No registrada'}</p>
                                <p><strong>Antigüedad:</strong> {calcularAntiguedad(empleadoFicha.fechaIngreso)}</p>
                                <p><strong>Turno Habitual:</strong> {empleadoFicha.turno || 'Jornada Completa'}</p>
                            </div>

                            {/* Datos Bancarios para Nómina */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-slate-700 flex items-center gap-1.5 uppercase text-[11px]">
                                        <CreditCard size={14} className="text-teal-600" /> Datos Bancarios para Nómina
                                    </h4>
                                    {(empleadoFicha.cuentaClabe || empleadoFicha.datosBancarios?.clabe) && (
                                        <button
                                            onClick={() => copyToClipboard(empleadoFicha.cuentaClabe || empleadoFicha.datosBancarios?.clabe)}
                                            className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 flex items-center gap-1"
                                        >
                                            <Copy size={12} /> {copiado ? '¡Copiada!' : 'Copiar CLABE'}
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <p><strong>Banco:</strong> {empleadoFicha.banco || empleadoFicha.datosBancarios?.banco || 'No especificado'}</p>
                                    <p><strong>CLABE (18 dígitos):</strong> <span className="font-mono text-slate-800 font-bold">{empleadoFicha.cuentaClabe || empleadoFicha.datosBancarios?.clabe || 'Pendiente de registrar'}</span></p>
                                </div>
                            </div>

                            {/* Datos Fiscales y Domicilio registrados por el colaborador */}
                            {(empleadoFicha.curp || empleadoFicha.rfc || empleadoFicha.domicilio) && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 sm:col-span-2">
                                    <h4 className="font-black text-slate-700 flex items-center gap-1.5 uppercase text-[11px]">
                                        <ShieldCheck size={14} className="text-teal-600" /> Datos Fiscales y Domicilio
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        {empleadoFicha.curp && <p><strong>CURP:</strong> <span className="font-mono text-slate-800 font-bold">{empleadoFicha.curp}</span></p>}
                                        {empleadoFicha.rfc && <p><strong>RFC:</strong> <span className="font-mono text-slate-800 font-bold">{empleadoFicha.rfc}</span></p>}
                                        {empleadoFicha.domicilio && <p className="sm:col-span-2"><strong>Domicilio Particular:</strong> {empleadoFicha.domicilio}</p>}
                                    </div>
                                </div>
                            )}

                            {/* Expediente Digital de Documentación */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-slate-700 flex items-center gap-1.5 uppercase text-[11px]">
                                        <FileText size={14} className="text-teal-600" /> Expediente Digital de Documentación
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-mono">Archivos del Personal</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Contrato Laboral', key: 'contratoUrl', icon: '📑' },
                                        { label: 'Identificación INE', key: 'ineUrl', icon: '🪪' },
                                        { label: 'Cédula Prof.', key: 'cedulaUrl', icon: '📜' },
                                        { label: 'Comprobante Dom.', key: 'comprobanteUrl', icon: '🏠' }
                                    ].map(docItem => {
                                        const docVal = empleadoFicha[docItem.key] || empleadoFicha.documentos?.[docItem.key];
                                        return (
                                            <div key={docItem.key} className="p-2.5 rounded-xl border border-slate-200 bg-white flex flex-col items-center text-center">
                                                <span className="text-xl mb-1">{docItem.icon}</span>
                                                <span className="text-[10px] font-bold text-slate-700">{docItem.label}</span>
                                                {docVal ? (
                                                    <a
                                                        href={docVal}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[9px] font-bold mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                                                    >
                                                        Ver PDF ?
                                                    </a>
                                                ) : (
                                                    <span className="text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Resumen Salarial Actual (Intacto) */}
                            <div className="bg-teal-500/10 p-4 rounded-2xl border border-teal-500/20 sm:col-span-2 flex justify-between items-center">
                                <div>
                                    <p className="text-[11px] font-bold text-teal-800 uppercase">Sueldo Base: {formatCurrency(empleadoFicha.sueldoBase)}</p>
                                    <p className="text-[11px] text-teal-700">Comisiones: {empleadoFicha.comisionServicios || 0}% Servicios · {empleadoFicha.comisionProductos || 0}% Productos</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-teal-700 uppercase font-black">Saldo Actual</p>
                                    <p className="text-xl font-black text-teal-900">{formatCurrency(empleadoFicha.saldoComisiones || 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEmpleadoFicha(null)}>Cerrar</Button>
                            {userRole === 'Administrador' && (
                                <Button variant="outline" onClick={() => { const emp = empleadoFicha; setEmpleadoFicha(null); setEmpleadoResetModal(emp); setResetExitoso(false); setCopiadoReset(false); }} className="border-amber-400 text-amber-800 hover:bg-amber-50 flex items-center gap-1.5">
                                    <KeyRound size={14} className="text-amber-600" /> Restablecer Clave (Alfra2026!)
                                </Button>
                            )}
                            <Button variant="primary" onClick={() => {
                                const emp = empleadoFicha;
                                setEmpleadoFicha(null);
                                handleOpenModal(emp);
                            }}>
                                Editar Información
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL RESTABLECER CONTRASEÑA STAFF */}
{empleadoResetModal && (
    <Modal isOpen={!!empleadoResetModal} onClose={() => setEmpleadoResetModal(null)} title="Restablecer Contraseña de Personal" maxWidth="max-w-md">
        {resetExitoso ? (
            <div className="text-center space-y-5 py-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-gray-900">¡Contraseña Restablecida!</h3>
                    <p className="text-xs text-gray-500 mt-1">Se asignó la contraseña genérica provisional a <strong className="text-gray-800">{empleadoResetModal.nombre}</strong>.</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-left text-xs space-y-2">
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-500 uppercase text-[10px]">Usuario / Correo:</span><span className="font-mono font-bold text-gray-800">{empleadoResetModal.email}</span></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-gray-500 uppercase text-[10px]">Nueva Clave Provisional:</span><span className="font-mono font-black text-amber-800 text-sm bg-white px-2 py-0.5 rounded border border-amber-300">Alfra2026!</span></div>
                    <p className="text-[10px] text-amber-700 italic pt-1">🔒 Al iniciar sesión con esta clave, el sistema le obligará inmediatamente a cambiarla por una propia.</p>
                </div>
                <div className="space-y-2">
                    <Button variant="primary" fullWidth onClick={() => { navigator.clipboard.writeText("Hola " + empleadoResetModal.nombre + ", se ha restablecido tu acceso a la app de Clínica ALFRA.\n\nUsuario: " + empleadoResetModal.email + "\nContraseña provisional: Alfra2026!\n\nAl ingresar, el sistema te pedirá crear tu nueva contraseña personal."); setCopiadoReset(true); setTimeout(() => setCopiadoReset(false), 2000); }}>
                        {copiadoReset ? "¡Credenciales Copiadas!" : "Copiar Credenciales para WhatsApp"}
                    </Button>
                    {empleadoResetModal.telefono && (
                        <Button variant="outline" fullWidth onClick={() => { const tel = String(empleadoResetModal.telefono).replace(/\D/g, ""); const msg = encodeURIComponent("Hola " + empleadoResetModal.nombre + ", se ha restablecido tu acceso a la app de Clínica ALFRA.\n\nUsuario: " + empleadoResetModal.email + "\nContraseña provisional: Alfra2026!\n\nAl ingresar, el sistema te pedirá crear tu nueva contraseña personal."); window.open("https://wa.me/52" + tel + "?text=" + msg, "_blank"); }} className="border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                            <MessageSquare size={14} className="mr-1.5" /> Enviar por WhatsApp
                        </Button>
                    )}
                    <Button variant="ghost" fullWidth onClick={() => setEmpleadoResetModal(null)}>Cerrar</Button>
                </div>
            </div>
        ) : (
            <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3 items-start">
                    <KeyRound size={22} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                        <p className="font-bold">Restablecimiento Oficial de Contraseña</p>
                        <p className="text-[11px] text-amber-800 mt-1">Se asignará la clave genérica <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">Alfra2026!</strong> a <strong>{empleadoResetModal.nombre}</strong> ({empleadoResetModal.email}).</p>
                        <p className="text-[10px] text-amber-700 mt-1.5 font-bold">⚠️ Cuando el colaborador ingrese, el sistema bloqueará su navegación y le exigirá crear su nueva contraseña personal antes de continuar.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setEmpleadoResetModal(null)} disabled={reseteandoPassword}>Cancelar</Button>
                    <Button variant="primary" onClick={handleEjecutarResetPassword} disabled={reseteandoPassword} className="bg-amber-600 hover:bg-amber-500 text-white">
                        {reseteandoPassword ? "Restableciendo..." : "Restablecer a Alfra2026!"}
                    </Button>
                </div>
            </div>
        )}
    </Modal>
)}

{/* MODAL ALTA / EDICIÓN CON FOTO Y EXPEDIENTE COMPLETO */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEmployee ? "Configurar Perfil de Colaborador" : "Alta de Nuevo Colaborador"}
                maxWidth="max-w-2xl"
                footer={exitoAlta ? null : (
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveEmployee} disabled={saving || subiendoFoto}>
                            {saving ? 'Guardando...' : (editingEmployee ? 'Actualizar Ficha' : 'Registrar y Crear Acceso')}
                        </Button>
                    </div>
                )}
            >
                {exitoAlta && credenciales ? (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-acero">¡Acceso Generado!</h3>
                            <p className="text-sm text-gray-500">Comparte estas credenciales con el nuevo colaborador para que ingrese a la app.</p>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 font-mono text-sm text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 bg-turquesa/10"><KeyRound size={16} className="text-turquesa" /></div>
                            <p className="mb-2 uppercase text-[10px] font-black text-gray-400">Usuario / Email</p>
                            <p className="text-acero font-bold mb-4 break-all">{credenciales.email}</p>
                            <p className="mb-2 uppercase text-[10px] font-black text-gray-400">Contraseña Temporal</p>
                            <p className="text-turquesa font-black text-lg tracking-wider">{credenciales.password}</p>
                        </div>
                        <div className="space-y-2">
                            <Button variant="primary" fullWidth onClick={() => copyToClipboard(`${credenciales.email} / ${credenciales.password}`)}>
                                {copiado ? '¡Copiado al Portapapeles!' : 'Copiar Credenciales'}
                            </Button>
                            <Button variant="ghost" fullWidth onClick={() => setIsModalOpen(false)}>Finalizar</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                        {/* ALERTA VISIBLE DE ERROR AL DAR DE ALTA */}
                        {formError && (
                            <div className="bg-rose-50 border-2 border-rose-300 text-rose-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-pulse">
                                <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={22} />
                                <div className="text-xs space-y-1 flex-1">
                                    <p className="font-black text-rose-900 uppercase tracking-wide">⚠️ Atención al registrar colaborador</p>
                                    <p className="font-semibold text-rose-800 leading-relaxed whitespace-pre-line">{formError}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormError('')}
                                    className="text-rose-400 hover:text-rose-700 p-1 rounded-lg transition-colors"
                                    title="Cerrar alerta"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {/* 1. SELECCIÓN DE FOTO DE PERFIL */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center gap-5">
                            <div className="relative group">
                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-turquesa bg-slate-200 flex items-center justify-center shadow-md">
                                    {formData.foto ? (
                                        <img src={formData.foto} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera size={26} className="text-slate-400" />
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleSubirFoto}
                                    className="hidden"
                                    id="fotoStaffInput"
                                    disabled={subiendoFoto}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-black text-slate-800 uppercase block">Fotografía del Colaborador</label>
                                <p className="text-[11px] text-slate-500 mt-0.5">Sube o toma una foto nítida para personalizar su expediente, gafete y recibos.</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <label
                                        htmlFor="fotoStaffInput"
                                        className={`px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase cursor-pointer transition-all ${subiendoFoto ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        {subiendoFoto ? 'Cargando foto...' : (formData.foto ? 'Cambiar Foto' : '📷 Cargar Foto')}
                                    </label>
                                    {formData.foto && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, foto: '' })}
                                            className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-xl"
                                        >
                                            Quitar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. DATOS PERSONALES & CONTACTO */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <UserCheck size={14} className="text-turquesa" /> 1. Datos Personales & Contacto
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Dra. Mariana González" 
                                        value={formData.nombre} 
                                        onChange={e => handleFieldChange('nombre', e.target.value)} 
                                        className={`w-full p-2.5 text-xs border rounded-xl outline-none transition-all ${invalidFields.includes('nombre') ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-200' : 'bg-gray-50 focus:bg-white focus:ring-2 focus:ring-turquesa/20'}`} 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Correo Electrónico (Acceso) *</label>
                                    <input 
                                        type="email" 
                                        placeholder="doctor@alfra.com" 
                                        value={formData.email} 
                                        onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20" 
                                        disabled={!!editingEmployee} 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Teléfono / WhatsApp</label>
                                    <input 
                                        type="tel" 
                                        placeholder="Ej. 449 123 4567" 
                                        value={formData.telefono} 
                                        onChange={e => setFormData({ ...formData, telefono: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20" 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Fecha de Nacimiento</label>
                                    <input 
                                        type="date" 
                                        value={formData.fechaNacimiento} 
                                        onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20" 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Contacto de Emergencia</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. Esposo / Mamá (Nombre)" 
                                        value={formData.contactoEmergenciaNombre} 
                                        onChange={e => setFormData({ ...formData, contactoEmergenciaNombre: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Teléfono Emergencia</label>
                                    <input 
                                        type="tel" 
                                        placeholder="Ej. 449 987 6543" 
                                        value={formData.contactoEmergenciaTelefono} 
                                        onChange={e => setFormData({ ...formData, contactoEmergenciaTelefono: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. DATOS LABORALES & ROL (CON DOCTOR INCLUIDO) */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Stethoscope size={14} className="text-turquesa" /> 2. Datos Laborales & Puesto
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Puesto / Rol en Clínica *</label>
                                    <select 
                                        value={formData.puesto} 
                                        onChange={e => setFormData({ ...formData, puesto: e.target.value })} 
                                        className="w-full p-2.5 text-xs font-bold border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20"
                                    >
                                        <option value="Doctor">🩺 Doctor / Médico Especialista</option>
                                        <option value="Especialista">💆 Especialista en Cabina</option>
                                        <option value="Cosmetóloga">🌸 Cosmetóloga</option>
                                        <option value="Recepcionista">📋 Recepcionista</option>
                                        <option value="Administrador">👑 Administrador</option>
                                        <option value="Limpieza">🧹 Limpieza e Intendencia</option>
                                    </select>
                                </div>

                                {formData.puesto === 'Cosmetóloga' ? (
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Nivel Cosmetóloga</label>
                                        <select 
                                            value={formData.nivelCosmetologa} 
                                            onChange={e => setFormData({ ...formData, nivelCosmetologa: e.target.value })} 
                                            className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none"
                                        >
                                            <option value="1">Nivel 1 (Inicial)</option>
                                            <option value="2">Nivel 2 (Intermedio)</option>
                                            <option value="3">Nivel 3 (Senior / Master)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Cédula Profesional SSA</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ej. CED. PROF. 12849203" 
                                            value={formData.cedulaProfesional} 
                                            onChange={e => setFormData({ ...formData, cedulaProfesional: e.target.value })} 
                                            className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Fecha de Ingreso a la Clínica</label>
                                    <input 
                                        type="date" 
                                        value={formData.fechaIngreso} 
                                        onChange={e => setFormData({ ...formData, fechaIngreso: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Turno Habitual</label>
                                    <select 
                                        value={formData.turno} 
                                        onChange={e => setFormData({ ...formData, turno: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none"
                                    >
                                        <option value="Completo">Jornada Completa</option>
                                        <option value="Matutino">Turno Matutino</option>
                                        <option value="Vespertino">Turno Vespertino</option>
                                        <option value="Mixto">Turno Mixto / Por Citas</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 4. DATOS BANCARIOS (PARA PAGOS / TRANSFERENCIAS) */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <CreditCard size={14} className="text-turquesa" /> 3. Datos Bancarios para Transferencias
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Banco Receptor</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ej. BBVA, Banorte, Santander..." 
                                        value={formData.banco} 
                                        onChange={e => setFormData({ ...formData, banco: e.target.value })} 
                                        className="w-full p-2.5 text-xs border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Cuenta CLABE Interbancaria (18 dígitos)</label>
                                    <input 
                                        type="text" 
                                        placeholder="0121800..." 
                                        maxLength={18}
                                        value={formData.cuentaClabe} 
                                        onChange={e => setFormData({ ...formData, cuentaClabe: e.target.value })} 
                                        className="w-full p-2.5 text-xs font-mono border rounded-xl bg-gray-50 focus:bg-white outline-none" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. ESQUEMA SALARIAL & COMISIONES (100% INTACTO) */}
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign size={14} className="text-turquesa" /> 4. Esquema Salarial & Comisiones
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                                        Sueldo Base <span className="text-gray-400 font-normal lowercase">(opcional, 0 si es solo comisión)</span>
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            value={formData.sueldoBase} 
                                            onChange={e => handleFieldChange('sueldoBase', e.target.value)} 
                                            className={`w-full p-2.5 text-xs font-bold border rounded-xl outline-none pl-7 transition-all ${invalidFields.includes('sueldoBase') ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-200' : 'bg-gray-50 focus:bg-white'}`} 
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">% Comisión Servicios</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="0" 
                                            value={formData.comisionServicios} 
                                            onChange={e => setFormData({ ...formData, comisionServicios: e.target.value })} 
                                            className="w-full p-2.5 text-xs font-bold border rounded-xl bg-turquesa/5 text-turquesa focus:bg-white outline-none pl-7" 
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-turquesa font-bold">%</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">% Comisión Productos</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="0" 
                                            value={formData.comisionProductos} 
                                            onChange={e => setFormData({ ...formData, comisionProductos: e.target.value })} 
                                            className="w-full p-2.5 text-xs font-bold border rounded-xl bg-gray-50 text-slate-700 focus:bg-white outline-none pl-7" 
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL ELIMINAR STAFF */}
            <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title="Confirmar Baja de Personal" maxWidth="max-w-sm">
                <div className="text-center space-y-4 py-2">
                    <Trash2 size={44} className="text-red-500 mx-auto" />
                    <div>
                        <p className="font-black text-acero text-lg leading-tight tracking-tight">¿Remover a <span className="text-red-500">{employeeToDelete?.nombre}</span>?</p>
                        <p className="text-xs text-gray-400 mt-2">Esta acción eliminará su registro de nómina. Los movimientos financieros históricos se conservarán.</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" fullWidth onClick={() => setEmployeeToDelete(null)}>Conservar</Button>
                        <Button variant="primary" className="bg-red-500 border-red-500 hover:bg-red-600 shadow-lg shadow-red-100" fullWidth onClick={handleDeleteStaff} disabled={confirmingDelete}>
                            {confirmingDelete ? 'Procesando baja...' : 'Confirmar Baja'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ═══ MODAL LIQUIDACIÓN DE NÓMINA (INTACTO) ═════════════════════════ */}
            <Modal
                isOpen={!!empleadoLiquidar}
                onClose={() => setEmpleadoLiquidar(null)}
                title="Liquidar Nómina"
                maxWidth="max-w-md"
            >
                {empleadoLiquidar && (
                    <div className="space-y-4">
                        <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-turquesa/10 flex items-center justify-center text-turquesa flex-shrink-0">
                                {(empleadoLiquidar.foto || empleadoLiquidar.fotoUrl) ? (
                                    <img src={empleadoLiquidar.foto || empleadoLiquidar.fotoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <DollarSign size={24} />
                                )}
                            </div>
                            <div>
                                <p className="font-black text-acero text-lg leading-tight">{empleadoLiquidar.nombre}</p>
                                <p className="text-xs text-turquesa font-bold uppercase tracking-widest">{empleadoLiquidar.puesto}</p>
                                {empleadoLiquidar.cuentaClabe && (
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">CLABE: {empleadoLiquidar.cuentaClabe}</p>
                                )}
                            </div>
                        </div>

                        {/* Selector de Período con Calendario */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                                    <Calendar size={14} className="text-teal-600" /> Período de Pago (Calendario)
                                </label>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => aplicarRangoSemana(0)}
                                        className="px-2 py-0.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-800 text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                        Esta Semana
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => aplicarRangoSemana(-1)}
                                        className="px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                        Semana Anterior
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Inicio:</label>
                                    <input
                                        type="date"
                                        value={nominaForm.fechaInicio || ''}
                                        onChange={e => handleCambiarFechasPeriodo(e.target.value, nominaForm.fechaFin)}
                                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Fin:</label>
                                    <input
                                        type="date"
                                        value={nominaForm.fechaFin || ''}
                                        onChange={e => handleCambiarFechasPeriodo(nominaForm.fechaInicio, e.target.value)}
                                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Leyenda en el Recibo de Pago:</label>
                                <input
                                    type="text"
                                    value={nominaForm.periodo}
                                    onChange={e => setNominaForm({ ...nominaForm, periodo: e.target.value })}
                                    placeholder="Ej. Semana del 26 de Octubre al 1 de Noviembre de 2026"
                                    className="w-full p-2.5 text-xs border border-teal-200 rounded-xl bg-white font-bold text-teal-900 focus:border-teal-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Auditoría Automática de Checador GPS */}
                        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                            retardosGpsPeriodo === 0
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : retardosGpsPeriodo > 0
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className={retardosGpsPeriodo === 0 ? 'text-emerald-600' : 'text-amber-600'} />
                                <div>
                                    <span className="font-bold block">
                                        {retardosGpsPeriodo === 0
                                            ? '100% Asistencia a Tiempo (Checador GPS)'
                                            : retardosGpsPeriodo > 0
                                                ? `Alerta: ${retardosGpsPeriodo} Retardo(s) detectado(s) en Checador GPS`
                                                : 'Consultando asistencias del Checador GPS...'}
                                    </span>
                                    <span className="text-[11px] opacity-80">
                                        {retardosGpsPeriodo === 0
                                            ? 'El colaborador califica para el Bono de Puntualidad completo.'
                                            : retardosGpsPeriodo > 0
                                                ? 'Registros satelitales indican llegadas posteriores a la hora de entrada.'
                                                : 'Verificando puntualidad en base de datos satelital.'}
                                    </span>
                                </div>
                            </div>
                            {retardosGpsPeriodo > 0 && empleadoLiquidar.usaBonos && (
                                <button
                                    type="button"
                                    onClick={() => setNominaForm(prev => ({ ...prev, bonoPuntualidad: 0 }))}
                                    className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-bold shrink-0 transition"
                                >
                                    Retirar Bono
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1">Sueldo Base a Pagar</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign size={16} className="text-gray-400" />
                                </div>
                                <input
                                    type="number"
                                    value={nominaForm.sueldoBase}
                                    onChange={e => setNominaForm({ ...nominaForm, sueldoBase: e.target.value })}
                                    className="w-full pl-8 pr-3 py-3 border rounded-xl bg-gray-50 font-bold text-acero"
                                />
                            </div>
                        </div>

                        {empleadoLiquidar.usaBonos && (
                            <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">Bono Puntualidad</label>
                                    <input
                                        type="number"
                                        value={nominaForm.bonoPuntualidad}
                                        onChange={e => setNominaForm({ ...nominaForm, bonoPuntualidad: e.target.value })}
                                        className="w-full p-2 border rounded-lg bg-white font-bold text-indigo-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">Bono Productividad</label>
                                    <input
                                        type="number"
                                        value={nominaForm.bonoProductividad}
                                        onChange={e => setNominaForm({ ...nominaForm, bonoProductividad: e.target.value })}
                                        className="w-full p-2 border rounded-lg bg-white font-bold text-indigo-900 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Sueldo Base:</span>
                                <span className="font-bold">{formatCurrency(nominaForm.sueldoBase || 0)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Comisiones acumuladas:</span>
                                <span className="font-bold text-turquesa">+{formatCurrency(empleadoLiquidar.saldoComisiones || 0)}</span>
                            </div>
                            {empleadoLiquidar.usaBonos && (
                                <>
                                    <div className="flex justify-between text-indigo-600">
                                        <span>Bono Puntualidad:</span>
                                        <span className="font-bold">+{formatCurrency(nominaForm.bonoPuntualidad || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-indigo-600">
                                        <span>Bono Productividad:</span>
                                        <span className="font-bold">+{formatCurrency(nominaForm.bonoProductividad || 0)}</span>
                                    </div>
                                </>
                            )}
                            <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-base text-acero">
                                <span>Total a Liquidar:</span>
                                <span className="text-turquesa">
                                    {formatCurrency(
                                        (Number(nominaForm.sueldoBase) || 0) +
                                        (Number(empleadoLiquidar.saldoComisiones) || 0) +
                                        (empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoPuntualidad) || 0) : 0) +
                                        (empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoProductividad) || 0) : 0)
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="ghost" onClick={() => setEmpleadoLiquidar(null)}>Cancelar</Button>
                            <Button
                                variant="primary"
                                onClick={() => handleLiquidar(nominaForm.metodoPago)}
                                disabled={liquidandoId === empleadoLiquidar.id}
                            >
                                {liquidandoId === empleadoLiquidar.id ? 'Liquidando...' : 'Confirmar Liquidación'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL BONOS (INTACTO) */}
            <Modal
                isOpen={!!empleadoBonos}
                onClose={() => setEmpleadoBonos(null)}
                title="Configuración de Bonos"
                maxWidth="max-w-sm"
            >
                {empleadoBonos && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Bono Puntualidad</label>
                            <input
                                type="number"
                                value={formBonos.puntualidad}
                                onChange={e => setFormBonos({ ...formBonos, puntualidad: e.target.value })}
                                className="w-full p-2.5 border rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Bono Productividad</label>
                            <input
                                type="number"
                                value={formBonos.productividad}
                                onChange={e => setFormBonos({ ...formBonos, productividad: e.target.value })}
                                className="w-full p-2.5 border rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEmpleadoBonos(null)}>Cancelar</Button>
                            <Button variant="primary" onClick={handleGuardarBonos}>Guardar Bonos</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL AJUSTE MANUAL (INTACTO) */}
            <Modal
                isOpen={!!empleadoAjuste}
                onClose={() => setEmpleadoAjuste(null)}
                title="Ajuste Manual de Comisión"
                maxWidth="max-w-sm"
            >
                {empleadoAjuste && (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-500">Ajusta el saldo de comisiones de <strong>{empleadoAjuste.nombre}</strong> (puedes usar números negativos para deducciones).</p>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Monto del Ajuste ($ MXN)</label>
                            <input
                                type="number"
                                placeholder="Ej. 500 o -200"
                                value={formAjuste.monto}
                                onChange={e => setFormAjuste({ ...formAjuste, monto: e.target.value })}
                                className="w-full p-2.5 border rounded-xl font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Motivo / Concepto</label>
                            <input
                                type="text"
                                placeholder="Ej. Bono extraordinario / Penalización..."
                                value={formAjuste.motivo}
                                onChange={e => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
                                className="w-full p-2.5 border rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEmpleadoAjuste(null)}>Cancelar</Button>
                            <Button variant="primary" onClick={handleAjustar} disabled={ajustando}>
                                {ajustando ? 'Aplicando...' : 'Aplicar Ajuste'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL DETALLE COMISIONES (INTACTO) */}
            <Modal
                isOpen={!!empleadoDetalle}
                onClose={() => setEmpleadoDetalle(null)}
                title={`Historial de Comisiones — ${empleadoDetalle?.nombre || ''}`}
                maxWidth="max-w-3xl"
            >
                {empleadoDetalle && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Saldo acumulado no liquidado</p>
                                <p className="text-2xl font-black text-turquesa">{formatCurrency(empleadoDetalle.saldoComisiones || 0)}</p>
                            </div>
                            <Badge variant="info">{(empleadoDetalle.historialComisiones || []).length} registros</Badge>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 text-xs">
                            {(empleadoDetalle.historialComisiones || []).length === 0 ? (
                                <p className="text-center py-8 text-gray-400 italic">No hay registros de comisión para este colaborador.</p>
                            ) : (
                                (empleadoDetalle.historialComisiones || []).map((h, idx) => (
                                    <div key={idx} className="py-2.5 flex justify-between items-center gap-3">
                                        <div>
                                            <p className="font-bold text-slate-700">{h.detalleMotivo || h.tipoVenta}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(h.fecha).toLocaleString('es-MX')}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <span className="font-black text-turquesa font-mono">{formatCurrency(h.comisionGanada)}</span>
                                            <button onClick={() => handleEliminarComision(idx)} className="text-red-400 hover:text-red-600">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* RECIBO DE NÓMINA (INTACTO) */}
            <ReciboNomina
                isOpen={reciboNominaOpen}
                onClose={() => setReciboNominaOpen(false)}
                datosNomina={datosReciboNomina}
            />
            {/* MODAL DE FIRMA DIGITAL DE CONFORMIDAD */}
            {empleadoFirmaModal && (
                <Modal
                    isOpen={Boolean(empleadoFirmaModal)}
                    onClose={() => setEmpleadoFirmaModal(null)}
                    title={`Firma Digital de Conformidad - ${empleadoFirmaModal.nombre}`}
                >
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Firma en el recuadro con el dedo o lápiz táctil para confirmar la recepción conforme de tu pago de nómina.
                        </p>
                        <div className="border-2 border-dashed border-teal-300 rounded-2xl bg-slate-50 p-3 flex flex-col items-center">
                            <canvas
                                ref={signatureCanvasRef}
                                width={320}
                                height={160}
                                className="bg-white rounded-xl touch-none border border-slate-200 cursor-crosshair w-full max-w-sm h-40 shadow-inner"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            <div className="flex items-center justify-between w-full pt-2 px-1">
                                <span className="text-[11px] text-slate-400">Trazo táctil digital</span>
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                                >
                                    Limpiar trazo
                                </button>
                            </div>
                        </div>
                        {empleadoFirmaModal.ultimaFirmaNomina?.fecha && (
                            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                                <span>?ltima firma registrada: {new Date(empleadoFirmaModal.ultimaFirmaNomina.fecha).toLocaleString('es-MX')}</span>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEmpleadoFirmaModal(null)}>
                                Cancelar
                            </Button>
                            <Button variant="primary" icon={Check} onClick={saveSignature} disabled={guardandoFirma}>
                                {guardandoFirma ? 'Guardando...' : 'Guardar Firma'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
