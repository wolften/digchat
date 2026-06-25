import { ButtonHTMLAttributes } from 'react';

export default function SecondaryButton({
    type = 'button',
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            type={type}
            className={
                `inline-flex items-center rounded-lg border border-ink/[0.12] bg-ink/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink/75 shadow-sm transition duration-150 ease-in-out hover:bg-ink/[0.08] hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-25 ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
