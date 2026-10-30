import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import DetalleComisionesContent from '../../components/especialista/DetalleComisionesContent';
import { auth } from '../../lib/firebase';
import { getStaffDocByUid, onStaffDocChange } from '../../services/staffService';

export default function MisComisiones() {
    const navigate = useNavigate();
    const [staffDoc, setStaffDoc] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        let unsubStaff = () => {};

        getStaffDocByUid(user.uid).then(docData => {
            if (docData) {
                setStaffDoc(docData);
                unsubStaff = onStaffDocChange(docData.id, (updated) => {
                    if (updated) setStaffDoc(updated);
                });
            }
            setLoading(false);
        }).catch(err => {
            console.error('Error cargando staffDoc en MisComisiones:', err);
            setLoading(false);
        });

        return () => {
            unsubStaff();
        };
    }, []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* ENCABEZADO DE PÁGINA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={ArrowLeft}
                        onClick={() => navigate('/agenda')}
                        className="rounded-xl border border-gray-200 hover:bg-gray-100"
                    >
                        Mi Agenda
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                Mis Comisiones
                            </h2>
                            <Badge variant="turquesa">Especialista</Badge>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                            Historial detallado de servicios, productos y liquidaciones de nómina
                        </p>
                    </div>
                </div>

                {staffDoc && (
                    <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-gray-100 shadow-xs self-start sm:self-auto">
                        <div className="w-8 h-8 rounded-lg bg-turquesa/10 text-turquesa flex items-center justify-center font-bold text-xs">
                            <UserCheck size={16} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-900 leading-none">{staffDoc.nombre}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{staffDoc.puesto || 'Especialista'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENIDO PRINCIPAL */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-turquesa mx-auto" />
                    <p className="text-sm font-bold text-gray-500">Cargando tus comisiones...</p>
                </div>
            ) : !staffDoc ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-2">
                    <p className="text-base font-bold text-gray-800">No encontramos tu perfil de staff</p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Asegúrate de que tu cuenta de especialista esté vinculada a la lista de colaboradores en administración.
                    </p>
                </div>
            ) : (
                <DetalleComisionesContent staffDoc={staffDoc} isModal={false} />
            )}
        </div>
    );
}
