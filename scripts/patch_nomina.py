# -*- coding: utf-8 -*-
import sys

with open('src/pages/admin/NominaView.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update import to include sincronizarBajasStaff
old_import = "onStaffChange, createEmpleado, updateEmpleado, deleteEmpleado,"
new_import = "onStaffChange, createEmpleado, updateEmpleado, deleteEmpleado, sincronizarBajasStaff,"

if old_import in text:
    text = text.replace(old_import, new_import, 1)
    print("Import actualizado con sincronizarBajasStaff.")
else:
    print("Aviso: old_import no coincidio exactamente.")

# 2. Add sincronizarBajasStaff in useEffect
old_use_effect = """    useEffect(() => {
        const unsub = onStaffChange((data) => {
            setStaff(data);
            setLoading(false);
        });"""

new_use_effect = """    useEffect(() => {
        // Sincronizar bajas historicas para asegurar revocacion en /usuarios
        sincronizarBajasStaff().catch(err => console.warn('Error sincronizando bajas staff:', err));

        const unsub = onStaffChange((data) => {
            setStaff(data);
            setLoading(false);
        });"""

if old_use_effect in text:
    text = text.replace(old_use_effect, new_use_effect, 1)
    print("useEffect de NominaView actualizado con sincronizarBajasStaff.")
else:
    print("Aviso: old_use_effect no coincidio exactamente.")

# 3. Update handleDeleteStaff
old_delete = """    const handleDeleteStaff = async () => {
        if (!employeeToDelete) return;
        setConfirmingDelete(true);
        try {
            await deleteEmpleado(employeeToDelete.id);
            setEmployeeToDelete(null);
        } catch (err) {
            console.error(err);
            alert('Error al dar de baja al empleado');
        } finally {
            setConfirmingDelete(false);
        }
    };"""

new_delete = """    const handleDeleteStaff = async () => {
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
    };"""

if old_delete in text:
    text = text.replace(old_delete, new_delete, 1)
    print("handleDeleteStaff actualizado con revocacion total.")
else:
    print("Aviso: old_delete no coincidio exactamente.")

with open('src/pages/admin/NominaView.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("NominaView.jsx actualizado con exito.")
