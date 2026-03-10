import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Global error boundary — catches any unhandled React render error
 * and shows a friendly recovery screen instead of a white screen.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Rendering error caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-10 max-w-md w-full text-center space-y-5">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="text-red-500" size={32} />
                        </div>
                        <h2 className="text-xl font-black text-gray-800">Ocurrió un error inesperado</h2>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            La aplicación encontró un problema al cargar esta sección.
                            Tus datos están seguros — esto es solo un error de interfaz.
                        </p>
                        {this.state.error && (
                            <code className="block text-xs text-red-600 bg-red-50 p-3 rounded-lg text-left break-all">
                                {this.state.error.message}
                            </code>
                        )}
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-turquesa text-white font-bold rounded-xl hover:bg-opacity-90 transition-all"
                        >
                            <RefreshCw size={16} /> Recargar la Aplicación
                        </button>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="text-sm text-gray-400 hover:text-gray-600 underline"
                        >
                            Intentar continuar sin recargar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
