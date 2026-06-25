import { InputHTMLAttributes } from 'react';

export default function Checkbox({
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-ink/[0.18] bg-ink/[0.04] text-accent shadow-sm focus:ring-accent/30 ' +
                className
            }
        />
    );
}
