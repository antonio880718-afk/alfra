import React from 'react';

export const Card = ({ children, className = '', title, subtitle, action, variant = 'default', noPadding = false }) => {
    const variants = {
        default: 'bg-white border-gray-100/80 premium-shadow hover:premium-shadow-hover',
        glass: 'glass-card',
        premium: 'bg-white border-turquesa/10 shadow-lg hover:shadow-xl hover:border-turquesa/20',
        subtle: 'bg-gray-50/50 border-gray-100 hover:bg-white transition-colors duration-300'
    };

    return (
        <div className={`
            rounded-2xl border transition-all duration-300 transform-gpu
            ${variants[variant] || variants.default} 
            ${className}
        `}>
            {(title || subtitle || action) && (
                <div className={`
                    flex justify-between items-start 
                    ${noPadding ? 'p-6 pb-2' : 'px-6 pt-6 mb-2'}
                `}>
                    <div className="space-y-1">
                        {title && (
                            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight leading-tight">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action && (
                        <div className="shrink-0 ml-4 translate-y-[-2px]">
                            {action}
                        </div>
                    )}
                </div>
            )}
            <div className={noPadding ? '' : 'p-6 pt-2'}>
                {children}
            </div>
        </div>
    );
};
