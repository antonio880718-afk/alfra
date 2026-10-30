import React from 'react';
import { X, Activity, Ruler } from 'lucide-react';

export default function HistorialMedidasModal({ isOpen, onClose, medidas = [] }) {
    if (!isOpen) return null;

    // Si no hay medidas reales, mostrar un placeholder o lista vacía
    // En este caso, usaremos las medidas que vienen de Firestore si existen
    const historialMedidas = medidas.length > 0
        ? medidas.map(m => ({
            fecha: m.fechaRegistro,
            peso: m.peso,
            cintura: m.medidas?.cintura || 0,
            cadera: m.medidas?.cadera || 0,
            brazo: m.medidas?.brazo || 0, // Nota: el especialista guarda muslos en muslos, brazo no está en el form actual pero lo dejamos por compatibilidad
            muslo: m.medidas?.muslos || 0
        }))
        : [
            { fecha: '2023-10-15', peso: 76.5, cintura: 85, cadera: 102, brazo: 31, muslo: 58 },
            { fecha: '2023-11-15', peso: 74.2, cintura: 82, cadera: 100, brazo: 30, muslo: 56 },
            { fecha: '2023-12-15', peso: 72.8, cintura: 80, cadera: 98, brazo: 29.5, muslo: 55 },
            { fecha: '2024-01-15', peso: 70.5, cintura: 78, cadera: 95, brazo: 28.5, muslo: 53.5 },
            { fecha: '2024-02-15', peso: 69.1, cintura: 76, cadera: 93.5, brazo: 28, muslo: 52 },
            { fecha: '2024-03-15', peso: 68.0, cintura: 74.5, cadera: 92, brazo: 27.5, muslo: 51 },
        ].reverse();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex justify-between items-center bg-gradient-to-r from-turquesa to-acero p-6 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Historial de Medidas</h2>
                            <p className="text-white/80 text-sm">Registro evolutivo de circunferencias corporales</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors group">
                        <X size={24} className="group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Body - Table */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">

                    <div className="bg-turquesa/5 border border-turquesa/20 rounded-xl p-4 mb-6 flex items-start gap-4">
                        <Ruler className="text-turquesa shrink-0 mt-1" />
                        <div>
                            <p className="text-sm text-acero font-semibold">Progreso Notable</p>
                            <p className="text-xs text-gray-600 mt-1">Desde tu primera sesión has reducido <b className="text-turquesa">10.5 cm</b> de cintura y bajado <b className="text-turquesa">8.5 kg</b> de peso. ¡Excelente trabajo!</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4 text-center">Peso</th>
                                    <th className="px-6 py-4 text-center">Cintura</th>
                                    <th className="px-6 py-4 text-center">Cadera</th>
                                    <th className="px-6 py-4 text-center">Brazo</th>
                                    <th className="px-6 py-4 text-center">Muslo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historialMedidas.map((medida, index) => (
                                    <tr key={index} className="hover:bg-turquesa/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {new Date(medida.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold">{medida.peso} kg</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600">{medida.cintura} cm</td>
                                        <td className="px-6 py-4 text-center text-gray-600">{medida.cadera} cm</td>
                                        <td className="px-6 py-4 text-center text-gray-600">{medida.brazo} cm</td>
                                        <td className="px-6 py-4 text-center text-gray-600">{medida.muslo} cm</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
