import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Check, X, Clock } from 'lucide-react';
import { onSolicitudesEliminacionChange, deletePaciente } from '../../services/pacientesService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function SolicitudesView() {
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const unsub = onSolicitudesEliminacionChange((data) => {
            setSolicitudes(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleAprobar = async (solicitud) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar al paciente ${solicitud.nombrePaciente}?`)) return;
        setActionLoading(true);
        try {
            // 1. Eliminar paciente (Soft delete)
            await deletePaciente(solicitud.pacienteId);
            // 2. Marcar solicitud como aprobada
            const docRef = doc(db, 'solicitudes_eliminacion_pacientes', solicitud.id);
            await updateDoc(docRef, { estado: 'aprobada', updatedAt: new Date().toISOString() });
            alert('Paciente eliminado y solicitud aprobada.');
        } catch (error) {
            console.error("Error aprobando solicitud:", error);
            alert('Error al procesar la solicitud.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRechazar = async (solicitud) => {
        if (!window.confirm(`¿Estás seguro de que deseas rechazar la solicitud de eliminación para ${solicitud.nombrePaciente}?`)) return;
        setActionLoading(true);
        try {
            const docRef = doc(db, 'solicitudes_eliminacion_pacientes', solicitud.id);
            await updateDoc(docRef, { estado: 'rechazada', updatedAt: new Date().toISOString() });
            alert('Solicitud rechazada.');
        } catch (error) {
            console.error("Error rechazando solicitud:", error);
            alert('Error al procesar la solicitud.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Buzón de Solicitudes</h1>
                    <p className="text-gray-600">Autorizaciones pendientes de Recepción</p>
                </div>
            </div>

            <Card className="p-6">
                {loading ? (
                    <div className="text-center text-gray-500 py-4">Cargando solicitudes...</div>
                ) : solicitudes.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">No hay solicitudes pendientes.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="py-3 px-4 font-semibold text-gray-700">Paciente</th>
                                    <th className="py-3 px-4 font-semibold text-gray-700">Motivo</th>
                                    <th className="py-3 px-4 font-semibold text-gray-700">Solicitado Por</th>
                                    <th className="py-3 px-4 font-semibold text-gray-700">Fecha</th>
                                    <th className="py-3 px-4 font-semibold text-gray-700">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {solicitudes.map((sol) => (
                                    <tr key={sol.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium text-gray-800">{sol.nombrePaciente}</td>
                                        <td className="py-3 px-4 text-gray-600">{sol.motivo}</td>
                                        <td className="py-3 px-4 text-gray-600">{sol.solicitadoPor}</td>
                                        <td className="py-3 px-4 text-gray-600 text-sm">
                                            {new Date(sol.fecha).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="primary"
                                                    onClick={() => handleAprobar(sol)}
                                                    disabled={actionLoading}
                                                    icon={Check}
                                                >
                                                    Aprobar
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="danger"
                                                    onClick={() => handleRechazar(sol)}
                                                    disabled={actionLoading}
                                                    icon={X}
                                                >
                                                    Rechazar
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
