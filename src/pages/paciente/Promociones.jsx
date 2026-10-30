import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Tag, Megaphone, Loader2, Image as ImageIcon } from 'lucide-react';
import { getFlyers } from '../../services/flyersService';

export default function Promociones() {
    const [flyers, setFlyers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFlyers = async () => {
            try {
                const data = await getFlyers();
                setFlyers(data || []);
            } catch (error) {
                console.error("Error cargando flyers:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFlyers();
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
            <header className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-turquesa/10 text-turquesa px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-turquesa/20">
                    <Megaphone size={14} /> Exclusivo para ti
                </div>
                <h1 className="text-2xl md:text-4xl font-black tracking-tight text-acero leading-none">Novedades y Promociones</h1>
                <p className="text-gray-500 font-medium">Mantente al tanto de nuestros últimos avisos y beneficios especiales.</p>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="animate-spin text-turquesa" size={40} />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando anuncios...</p>
                </div>
            ) : flyers.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 pt-4">
                    {flyers.map((flyer) => (
                        <div key={flyer.id} className="group relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 bg-white hover:shadow-turquesa/10 transition-all duration-500">
                            <div className="aspect-[16/9] overflow-hidden">
                                <img
                                    src={flyer.imageUrl}
                                    alt={flyer.title}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
                                <span className="inline-flex items-center gap-1 bg-turquesa text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider mb-3 w-fit">
                                    <Tag size={10} /> Promo ALFRA
                                </span>
                                <h2 className="text-white font-black text-2xl tracking-tight leading-none drop-shadow-lg">{flyer.title}</h2>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Card className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={40} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-acero">Por el momento no hay anuncios</h3>
                        <p className="text-gray-500">Vuelve pronto para conocer nuestras promociones permanentes.</p>
                    </div>
                </Card>
            )}

            <footer className="pt-10 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">© 2026 Clínica ALFRA | Cirugía y Medicina Estética</p>
            </footer>
        </div>
    );
}
