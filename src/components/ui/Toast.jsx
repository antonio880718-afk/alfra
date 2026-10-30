import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    useEffect(() => {
        if (duration) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const styles = {
        success: {
            bg: 'bg-emerald-500',
            icon: <CheckCircle className="text-white" size={20} />,
        },
        error: {
            bg: 'bg-rose-500',
            icon: <AlertCircle className="text-white" size={20} />,
        },
        loading: {
            bg: 'bg-acero',
            icon: <Loader2 className="text-white animate-spin" size={20} />,
        },
    };

    const currentStyle = styles[type] || styles.success;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`${currentStyle.bg} shadow-2xl shadow-black/20 backdrop-blur-md px-6 py-4 rounded-2xl flex items-center gap-4 min-w-[300px] border border-white/20`}>
                <div className="shrink-0">
                    {currentStyle.icon}
                </div>
                <div className="flex-1">
                    <p className="text-white font-bold text-sm leading-tight">{message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/60"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
