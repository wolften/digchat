import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { ShieldCheck, UserRound } from 'lucide-react';

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AuthenticatedLayout
            header={
                <h2>
                    Perfil
                </h2>
            }
        >
            <Head title="Perfil" />

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-5">
                    <div className="flex flex-col gap-4 rounded-2xl border border-accent/12 bg-ink/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent shadow-sm">
                                <UserRound className="size-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-manrope text-2xl font-semibold tracking-tight text-ink">
                                        Meu perfil
                                    </h1>
                                    <Badge variant="secondary" className="gap-1">
                                        <ShieldCheck className="size-3" />
                                        Conta segura
                                    </Badge>
                                </div>
                                <p className="mt-1 max-w-2xl text-sm text-ink/55">
                                    Atualize como seu nome aparece no sistema e mantenha sua senha protegida.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.82fr)]">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="min-w-0"
                        />

                        <UpdatePasswordForm className="min-w-0" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
