import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, Mail, Save, UserRound } from 'lucide-react';
import { FormEventHandler } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}: {
    mustVerifyEmail: boolean;
    status?: string;
    className?: string;
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        patch(route('profile.update'), {
            preserveScroll: true,
        });
    };

    return (
        <Card className={className}>
            <CardHeader className="gap-3 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                        <UserRound className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="text-lg">
                            Dados do perfil
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Altere o nome exibido dentro do DigChat.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <form onSubmit={submit}>
                <CardContent className="flex flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Nome no sistema</Label>

                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            required
                            autoFocus
                            autoComplete="name"
                            aria-invalid={Boolean(errors.name)}
                            className="h-11"
                        />

                        <InputError message={errors.name} />
                    </div>

                    <div className="rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-ink/40">
                            <Mail className="size-3.5" />
                            Email de acesso
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-ink/72">
                            {user.email}
                        </p>
                    </div>

                    {mustVerifyEmail && user.email_verified_at === null && (
                        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                            <p className="text-sm text-ink/70">
                                Seu email ainda não foi verificado.{' '}
                                <Link
                                    href={route('verification.send')}
                                    method="post"
                                    as="button"
                                    className="font-medium text-accent underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-accent/30"
                                >
                                    Reenviar verificação
                                </Link>
                            </p>

                            {status === 'verification-link-sent' && (
                                <div className="mt-2 text-sm font-medium text-accent">
                                    Enviamos um novo link para o seu email.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col items-start gap-3 p-5 pt-0 sm:flex-row sm:items-center sm:p-6 sm:pt-0">
                    <Button type="submit" disabled={processing} size="lg">
                        <Save data-icon="inline-start" />
                        Salvar nome
                    </Button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0 translate-y-1"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <p className="flex items-center gap-1.5 text-sm font-medium text-accent">
                            <CheckCircle2 className="size-4" />
                            Nome atualizado.
                        </p>
                    </Transition>
                </CardFooter>
            </form>
        </Card>
    );
}
