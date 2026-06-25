import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen flex-col items-center px-4 pt-8 text-ink sm:justify-center sm:pt-0">
            <div className="flex flex-col items-center gap-3">
                <Link
                    href="/"
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent shadow-[0_0_40px_rgb(var(--accent-rgb)/0.18)]"
                >
                    <ApplicationLogo className="h-9 w-9 fill-current" />
                </Link>
                <div className="text-center">
                    <p className="font-manrope text-xs font-bold uppercase tracking-widest text-accent">
                        DigChat
                    </p>
                    <p className="text-xs text-ink/45">
                        Atendimento inteligente
                    </p>
                </div>
            </div>

            <div className="glass-card glass-card-static mt-6 w-full overflow-hidden rounded-2xl px-6 py-5 shadow-2xl sm:max-w-md">
                {children}
            </div>
        </div>
    );
}
