import React from 'react';

export const Input = ({ label, id, error, icon: Icon, className = '', ...props }) => {
    return (
        <div className={`flex flex-col space-y-1.5 ${className}`}>
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    id={id}
                    className={`
            w-full rounded-xl border bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors
            focus:border-turquesa focus:bg-white focus:outline-none focus:ring-1 focus:ring-turquesa
            disabled:cursor-not-allowed disabled:opacity-50
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}
          `}
                    {...props}
                />
            </div>
            {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
        </div>
    );
};
