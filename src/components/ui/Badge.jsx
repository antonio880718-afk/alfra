import React from 'react';

export const Badge = ({ children, variant = 'gray', className = '' }) => {
    const variants = {
        gray: 'bg-gray-100 text-gray-700 border-gray-200',
        turquesa: 'bg-turquesa/10 text-turquesa border-turquesa/20',
        blue: 'bg-acero/10 text-acero border-acero/20',
        green: 'bg-green-100 text-green-700 border-green-200',
        yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        red: 'bg-red-100 text-red-700 border-red-200',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
