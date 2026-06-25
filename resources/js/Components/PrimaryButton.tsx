import { ButtonHTMLAttributes } from 'react';

export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded-lg border border-accent/30 bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-widest text-canvas shadow-sm transition duration-150 ease-in-out hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/30 active:translate-y-px ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
