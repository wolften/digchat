import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active?: boolean }) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-accent bg-accent/10 text-accent focus:border-accent focus:bg-accent/15'
                    : 'border-transparent text-ink/60 hover:border-accent/40 hover:bg-ink/[0.06] hover:text-ink focus:border-accent/40 focus:bg-ink/[0.06] focus:text-ink'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
