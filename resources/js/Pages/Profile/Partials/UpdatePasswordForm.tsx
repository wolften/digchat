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
import { useForm } from '@inertiajs/react';
import { CheckCircle2, KeyRound, LockKeyhole, Save } from 'lucide-react';
import { FormEventHandler, useRef } from 'react';

export default function UpdatePasswordForm({
    className = '',
}: {
    className?: string;
}) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    return (
        <Card className={className}>
            <CardHeader className="gap-3 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                        <LockKeyhole className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="text-lg">
                            Trocar senha
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Informe a senha atual e defina uma nova senha de acesso.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <form onSubmit={updatePassword}>
                <CardContent className="flex flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="current_password">
                            Senha atual
                        </Label>

                        <Input
                            id="current_password"
                            ref={currentPasswordInput}
                            value={data.current_password}
                            onChange={(e) =>
                                setData('current_password', e.target.value)
                            }
                            type="password"
                            autoComplete="current-password"
                            aria-invalid={Boolean(errors.current_password)}
                            className="h-11"
                        />

                        <InputError message={errors.current_password} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">Nova senha</Label>

                        <Input
                            id="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.password)}
                            className="h-11"
                        />

                        <InputError message={errors.password} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password_confirmation">
                            Confirmar nova senha
                        </Label>

                        <Input
                            id="password_confirmation"
                            value={data.password_confirmation}
                            onChange={(e) =>
                                setData('password_confirmation', e.target.value)
                            }
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.password_confirmation)}
                            className="h-11"
                        />

                        <InputError message={errors.password_confirmation} />
                    </div>

                    <div className="rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-3 text-sm text-ink/55">
                        <div className="flex items-center gap-2 font-medium text-ink/70">
                            <KeyRound className="size-4" />
                            Recomendação
                        </div>
                        <p className="mt-1">
                            Use uma senha longa, única e difícil de adivinhar.
                        </p>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col items-start gap-3 p-5 pt-0 sm:flex-row sm:items-center sm:p-6 sm:pt-0">
                    <Button type="submit" disabled={processing} size="lg">
                        <Save data-icon="inline-start" />
                        Atualizar senha
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
                            Senha atualizada.
                        </p>
                    </Transition>
                </CardFooter>
            </form>
        </Card>
    );
}
