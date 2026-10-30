import React from 'react';

export const Button = ({
    children,
    variant = 'primary', // primary, secondary, outline, ghost, danger
    size = 'md', // sm, md, lg
    className = '',
    fullWidth = false,
    icon: Icon,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-xl transition-all-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-turquesa text-white hover:bg-opacity-90 focus:ring-turquesa shadow-sm",
        secondary: "bg-acero text-white hover:bg-opacity-90 focus:ring-acero shadow-sm",
        outline: "border-2 border-turquesa text-turquesa hover:bg-turquesa/5 focus:ring-turquesa",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200",
        danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500"
    };

    const sizes = {
        xs: "px-2 py-1 text-[10px] gap-1",
    sm: "px-3 py-1.5 text-sm gap-1.5",
        md: "px-4 py-2 text-sm gap-2",
        lg: "px-6 py-3 text-base gap-2"
    };

    const widthStyle = fullWidth ? "w-full" : "";

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
            {...props}
        >
            {Icon && <Icon size={size === 'xs' ? 12 : size === 'sm' ? 16 : 20} />}
            {children}
        </button>
    );
};
