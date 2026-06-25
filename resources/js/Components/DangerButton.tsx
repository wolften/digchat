import { ButtonHTMLAttributes } from 'react';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded-lg border border-red-400/30 bg-red-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition duration-150 ease-in-out hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400/30 active:translate-y-px ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
