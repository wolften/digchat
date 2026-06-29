import ApplicationLogo from '@/Components/ApplicationLogo';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { PageProps } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    LockKeyhole,
    Mail,
} from 'lucide-react';
import { FormEventHandler } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { appName, appIconUrl } = usePage<PageProps>().props;
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="Entrar">
                {appIconUrl && (
                    <link rel="icon" href={appIconUrl} />
                )}
            </Head>

            <main className="relative h-[100svh] overflow-hidden bg-[#08110c] text-white">
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(34,197,94,0.18),transparent_30%),linear-gradient(330deg,rgba(255,184,77,0.12),transparent_34%),radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.09),transparent_32%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-45" />

                <div className="relative flex h-full w-full items-center justify-center px-4 py-4 sm:px-6">
                    <section className="flex h-full items-center justify-center py-3">
                        <div className="w-full max-w-[460px]">
                            <div className="rounded-[2rem] border border-white/12 bg-[#f7fbf8] p-2 text-[#102016] shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
                                <div className="rounded-[1.55rem] border border-[#dfe8e2] bg-white p-6 shadow-inner shadow-white sm:p-7">
                                    <div className="mb-7">
                                        <div className="mb-5 flex items-center gap-3">
                                            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#102016] text-accent shadow-[0_12px_30px_rgba(16,32,22,0.22)]">
                                                {appIconUrl ? (
                                                    <img
                                                        src={appIconUrl}
                                                        alt={appName}
                                                        className="size-7 rounded-lg object-contain"
                                                    />
                                                ) : (
                                                    <LockKeyhole className="size-5" />
                                                )}
                                            </span>
                                            <div>
                                                <p className="font-cabin text-base font-bold text-[#102016]">
                                                    {appName || 'DigChat'}
                                                </p>
                                                <p className="text-xs text-[#5a7a63]">
                                                    Atendimento inteligente
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-cabin text-xs font-bold uppercase tracking-[0.18em] text-[#5a7a63]">
                                            Acesso seguro
                                        </p>
                                        <h2 className="mt-3 font-serif text-4xl leading-none text-[#102016]">
                                            Bem-vindo de volta.
                                        </h2>
                                        <p className="mt-3 text-sm leading-6 text-[#5e6f63]">
                                            Use suas credenciais para continuar no painel
                                            de atendimento.
                                        </p>
                                    </div>

                                    {status && (
                                        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-medium text-[#1d5e32]">
                                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                                            <span>{status}</span>
                                        </div>
                                    )}

                                    <form onSubmit={submit} className="flex flex-col gap-5">
                                        <div className="flex flex-col gap-2">
                                            <Label
                                                htmlFor="email"
                                                className="text-[#263c2d]"
                                            >
                                                Email
                                            </Label>
                                            <div className="relative">
                                                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#77917e]" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    name="email"
                                                    value={data.email}
                                                    className="h-12 border-[#d9e4dc] bg-[#f7fbf8] pl-10 text-[#102016] caret-[#102016] [-webkit-text-fill-color:#102016] placeholder:text-[#8aa493] placeholder:[-webkit-text-fill-color:#8aa493] autofill:shadow-[inset_0_0_0_1000px_#f7fbf8] autofill:[-webkit-text-fill-color:#102016] focus-visible:border-accent/70"
                                                    autoComplete="username"
                                                    autoFocus
                                                    placeholder="voce@empresa.com"
                                                    aria-invalid={!!errors.email}
                                                    onChange={(e) =>
                                                        setData('email', e.target.value)
                                                    }
                                                />
                                            </div>
                                            <InputError
                                                message={errors.email}
                                                className="text-[#b42318]"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label
                                                htmlFor="password"
                                                className="text-[#263c2d]"
                                            >
                                                Senha
                                            </Label>
                                            <div className="relative">
                                                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#77917e]" />
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    name="password"
                                                    value={data.password}
                                                    className="h-12 border-[#d9e4dc] bg-[#f7fbf8] pl-10 text-[#102016] caret-[#102016] [-webkit-text-fill-color:#102016] placeholder:text-[#8aa493] placeholder:[-webkit-text-fill-color:#8aa493] autofill:shadow-[inset_0_0_0_1000px_#f7fbf8] autofill:[-webkit-text-fill-color:#102016] focus-visible:border-accent/70"
                                                    autoComplete="current-password"
                                                    placeholder="Digite sua senha"
                                                    aria-invalid={!!errors.password}
                                                    onChange={(e) =>
                                                        setData('password', e.target.value)
                                                    }
                                                />
                                            </div>
                                            <InputError
                                                message={errors.password}
                                                className="text-[#b42318]"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <label className="flex items-center gap-2 text-sm text-[#52645a]">
                                                <Checkbox
                                                    name="remember"
                                                    checked={data.remember}
                                                    onChange={(e) =>
                                                        setData('remember', e.target.checked)
                                                    }
                                                    className="size-4 border-[#cddbd2] bg-white"
                                                />
                                                <span>Manter conectado</span>
                                            </label>

                                        </div>

                                        <Button
                                            type="submit"
                                            size="lg"
                                            disabled={processing}
                                            className="h-12 w-full rounded-xl bg-[#102016] text-base font-semibold text-white shadow-[0_18px_36px_rgba(16,32,22,0.24)] hover:bg-[#183827]"
                                        >
                                            {processing ? 'Entrando...' : 'Entrar no painel'}
                                            <ArrowRight data-icon="inline-end" />
                                        </Button>
                                    </form>

                                </div>
                            </div>

                            <p className="mt-4 text-center text-xs text-white/45">
                                Ambiente protegido para equipes de atendimento.
                            </p>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
