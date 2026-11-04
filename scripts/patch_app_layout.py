# -*- coding: utf-8 -*-
import sys

with open('src/components/layout/AppLayout.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import for notificationService
if 'notificationService' not in text:
    import_line = "import { emitirNotificacion, solicitarPermisoNotificaciones } from '../../services/notificationService';\n"
    insert_pos = text.find("import { onAlertasAdminChange")
    if insert_pos != -1:
        text = text[:insert_pos] + import_line + text[insert_pos:]
    else:
        text = import_line + text

# 2. Replace setupAlerts logic
marker1 = 'export default function AppLayout() {'
marker2 = 'const handleDismissAlerta = async (id) => {'

idx1 = text.find(marker1)
idx2 = text.find(marker2)

if idx1 == -1 or idx2 == -1:
    print("Error: No se encontraron los marcadores de setupAlerts en AppLayout.jsx")
    sys.exit(1)

replacement = """export default function AppLayout() {
    const { userRole, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [alertas, setAlertas] = useState([]);
    const [showAlertas, setShowAlertas] = useState(false);
    const prevAlertIds = React.useRef(new Set());
    const isFirstAlertLoad = React.useRef(true);

    const procesarAlertas = (alerts) => {
        setAlertas(alerts);
        // Si no es la primera carga inicial, emitir notificacion del sistema y sonido al llegar una alerta nueva
        if (!isFirstAlertLoad.current) {
            const nuevas = alerts.filter(a => !prevAlertIds.current.has(a.id));
            if (nuevas.length > 0) {
                const primera = nuevas[0];
                emitirNotificacion('Clinica ALFRA', {
                    body: primera.mensaje,
                    tag: 'alerta-' + primera.id,
                    onClick: () => setShowAlertas(true)
                });
            }
        } else {
            isFirstAlertLoad.current = false;
        }
        prevAlertIds.current = new Set(alerts.map(a => a.id));
    };

    useEffect(() => {
        let active = true;
        let unsub = () => {};

        // Solicitar permisos nativos y de navegador al montar la sesion
        solicitarPermisoNotificaciones().catch(() => {});

        const setupAlerts = async () => {
            if (userRole === 'Administrador' || userRole === 'Recepcionista') {
                unsub = onAlertasAdminChange((alerts) => {
                    if (active) procesarAlertas(alerts);
                });
            } else if (userRole === 'Especialista' || userRole === 'Doctor') {
                const auth = getAuth();
                const uid = auth.currentUser?.uid;
                if (uid) {
                    const staffDoc = await getStaffDocByUid(uid);
                    if (!active) return;
                    const docId = staffDoc ? staffDoc.id : uid;
                    unsub = onAlertasEspecialistaChange(docId, (alerts) => {
                        if (active) procesarAlertas(alerts);
                    });
                }
            } else if (userRole === 'Paciente' || userRole === 'Limpieza') {
                const auth = getAuth();
                const uid = auth.currentUser?.uid;
                if (uid) {
                    const p = await getPacienteByUid(uid);
                    if (!active) return;
                    if (p?.id) {
                        unsub = onAlertasPacienteChange(p.id, (alerts) => {
                            if (active) procesarAlertas(alerts);
                        });
                    }
                }
            }
        };

        setupAlerts();

        return () => {
            active = false;
            unsub();
        };
    }, [userRole]);

    """

text = text[:idx1] + replacement + text[idx2:]

# 3. Add onClick to alert cards in panel so clicking any card dismisses it immediately
old_card_str = 'alertas.map(a => (\n                                    <div key={a.id} className="flex items-start gap-3 p-3 bg-turquesa/5 rounded-2xl border border-turquesa/10 hover:bg-turquesa/10 transition-all group">'
new_card_str = 'alertas.map(a => (\n                                    <div key={a.id} onClick={() => handleDismissAlerta(a.id)} className="flex items-start gap-3 p-3 bg-turquesa/5 rounded-2xl border border-turquesa/10 hover:bg-turquesa/15 transition-all group cursor-pointer" title="Clic para descartar y marcar como leida">'

if old_card_str in text:
    text = text.replace(old_card_str, new_card_str)
    print("Tarjeta de alerta actualizada con descarte al clic.")
else:
    print("Aviso: old_card_str no coincidio exactamente, pero el listener principal si fue actualizado.")

with open('src/components/layout/AppLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AppLayout.jsx actualizado con exito.")
