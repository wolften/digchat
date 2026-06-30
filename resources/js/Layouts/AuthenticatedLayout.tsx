import ApplicationLogo from '@/Components/ApplicationLogo';
import { HeaderClock } from '@/Components/HeaderClock';
import { InternalChat } from '@/Components/InternalChat';
import { Toaster } from '@/Components/ui/sonner';
import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Bot,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    CircleDot,
    Clock,
    Gauge,
    GitBranch,
    History,
    LogOut,
    Menu,
    MessageCircle,
    MessageSquare,
    Moon,
    Radio,
    Settings,
    Building2,
    Sun,
    Tag,
    User,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

type NavItem = {
    label: string;
    href: string;
    active: boolean;
    icon: typeof Gauge;
    badge?: number;
    managerOnly?: boolean;
    adminOnly?: boolean;
};

type NavConfig = Omit<NavItem, 'href' | 'active'> & {
    routeName: string;
    activePattern: string;
};

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const page = usePage<PageProps>();
    const user = page.props.auth.user;
    const flash = page.props.flash;
    const appName = page.props.appName;
    const appIconUrl = page.props.appIconUrl;
    const appSubtitle = page.props.appSubtitle;
    const inboxBadgeCount = page.props.inboxBadgeCount ?? 0;
    const isManager = user.role === 'admin' || user.role === 'gestor';
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('digchat-sidebar-collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const { theme, toggle: toggleTheme } = useTheme();
    useNotifications(user.id);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const toggleCollapsed = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('digchat-sidebar-collapsed', String(next));
            } catch {}
            return next;
        });
    };

    const navConfig: NavConfig[] = [
        {
            label: 'Dashboard',
            routeName: 'dashboard',
            activePattern: 'dashboard',
            icon: Gauge,
        },
        {
            label: 'Atendimento',
            routeName: 'inbox.index',
            activePattern: 'inbox.*',
            icon: MessageCircle,
            badge: inboxBadgeCount || undefined,
        },
        {
            label: 'Histórico',
            routeName: 'historico.index',
            activePattern: 'historico.*',
            icon: History,
            managerOnly: true,
        },
        {
            label: 'Fluxos',
            routeName: 'flows.index',
            activePattern: 'flows.*',
            icon: GitBranch,
            managerOnly: true,
        },
        {
            label: 'Pesquisas',
            routeName: 'pesquisas.index',
            activePattern: 'pesquisas.*',
            icon: MessageSquare,
            managerOnly: true,
        },
        {
            label: 'Presença',
            routeName: 'presence.index',
            activePattern: 'presence.*',
            icon: CircleDot,
            managerOnly: true,
        },
        {
            label: 'Setores',
            routeName: 'setores.index',
            activePattern: 'setores.*',
            icon: Building2,
            managerOnly: true,
        },
        {
            label: 'Canais',
            routeName: 'canais.index',
            activePattern: 'canais.*',
            icon: Radio,
            managerOnly: true,
        },
        {
            label: 'Respostas Rápidas',
            routeName: 'respostas-rapidas.index',
            activePattern: 'respostas-rapidas.*',
            icon: Zap,
            managerOnly: true,
        },
        {
            label: 'Etiquetas',
            routeName: 'tags.index',
            activePattern: 'tags.*',
            icon: Tag,
            managerOnly: true,
        },
        {
            label: 'Horários',
            routeName: 'horarios.index',
            activePattern: 'horarios.*',
            icon: Clock,
            managerOnly: true,
        },
{
            label: 'Usuários',
            routeName: 'users.index',
            activePattern: 'users.*',
            icon: Users,
            managerOnly: true,
        },
        {
            label: 'Configurações',
            routeName: 'configuracoes.index',
            activePattern: 'configuracoes.*',
            icon: Settings,
            adminOnly: true,
        },
    ];

    const navItems: NavItem[] = navConfig
        .filter((item) => {
            if (item.adminOnly) return user.role === 'admin';
            if (item.managerOnly) return isManager;
            return true;
        })
        .flatMap((item) => {
            try {
                return [
                    {
                        ...item,
                        href: route(item.routeName),
                        active: route().current(item.activePattern),
                    },
                ];
            } catch {
                return [];
            }
        });

    const initials = user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    const makeSidebar = (collapsed: boolean) => (
        <aside
            className={cn(
                'glass-nav relative flex h-full shrink-0 flex-col overflow-visible border-r border-accent/10 md:rounded-2xl md:border transition-[width] duration-200',
                collapsed ? 'w-16' : 'w-72 md:w-64',
            )}
        >
            <div
                className={cn(
                    'flex h-16 items-center border-b border-accent/10 px-3',
                    collapsed ? 'justify-center' : 'gap-3',
                )}
            >
                <Link
                    href={route('dashboard')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-accent"
                >
                    {appIconUrl ? (
                        <img src={appIconUrl} alt={appName} className="h-full w-full object-cover" />
                    ) : (
                        <span className="font-manrope text-sm font-bold uppercase text-accent">
                            {appName?.charAt(0) ?? 'D'}
                        </span>
                    )}
                </Link>
                {!collapsed && (
                    <div className="min-w-0 flex-1">
                        <p className="font-manrope text-[11px] font-bold uppercase tracking-widest text-accent">
                            {appName}
                        </p>
                        <p className="truncate text-[11px] text-ink/40">
                            {appSubtitle}
                        </p>
                    </div>
                )}
            </div>

            <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-2 py-3">
                {navItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                'group flex h-9 items-center rounded-xl text-xs font-medium transition-all',
                                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                                item.active
                                    ? 'bg-accent text-canvas hover:bg-accent/90 dark:text-black dark:hover:text-black'
                                    : 'text-ink/62 hover:bg-ink/[0.06] hover:text-ink',
                            )}
                        >
                            <div className="relative shrink-0">
                                <Icon
                                    className={cn(
                                        'h-3.5 w-3.5 transition-colors',
                                        item.active
                                            ? 'text-canvas dark:text-black'
                                            : 'text-ink/40 group-hover:text-ink',
                                    )}
                                />
                                {collapsed && !!item.badge && (
                                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-0.5 text-[9px] font-bold leading-none text-white dark:bg-green-600 dark:text-black">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </div>
                            {!collapsed && (
                                <>
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {!!item.badge && (
                                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white dark:bg-green-600 dark:text-black">
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                </>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-accent/10 p-2">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setUserMenuOpen((open) => !open)}
                        aria-expanded={userMenuOpen}
                        title={collapsed ? user.name : undefined}
                        className={cn(
                            'flex w-full items-center rounded-xl px-2 py-2 text-left transition hover:bg-ink/[0.06]',
                            collapsed ? 'justify-center' : 'gap-2',
                        )}
                    >
                        <div className="relative shrink-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/35 bg-accent/20 font-manrope text-xs font-bold text-accent">
                                {initials || 'DC'}
                            </div>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent" />
                        </div>
                        {!collapsed && (
                            <>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-ink/82">
                                        {user.name}
                                    </p>
                                    <p className="truncate text-[11px] text-ink/38">
                                        {user.email}
                                    </p>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-ink/35" />
                            </>
                        )}
                    </button>

                    {userMenuOpen && (
                        <div
                            className={cn(
                                'absolute z-50 rounded-xl border border-accent/20 bg-white p-1 shadow-xl dark:bg-[#142a1b]',
                                collapsed
                                    ? 'bottom-0 left-full ml-2 w-40'
                                    : 'bottom-full left-0 right-0 mb-2',
                            )}
                        >
                            <Link
                                href={route('profile.edit')}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink/72 transition hover:bg-accent/10 hover:text-accent"
                            >
                                <User className="h-4 w-4 shrink-0" />
                                Perfil
                            </Link>
                            <Link
                                href={route('logout')}
                                method="post"
                                as="button"
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                            >
                                <LogOut className="h-4 w-4 shrink-0" />
                                Sair
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );

    return (
        <div className="app-shell flex h-screen min-h-screen overflow-hidden p-0 text-ink md:p-2">
            {appIconUrl && (
                <Head>
                    <link rel="icon" href={appIconUrl} />
                </Head>
            )}
            <Toaster position="top-right" offset="16px" closeButton theme={theme} />

            <div className="hidden md:block">{makeSidebar(sidebarCollapsed)}</div>

            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Fechar menu"
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="relative h-full max-w-[18rem]">
                        {makeSidebar(false)}
                    </div>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col md:pl-2">
                <div className="shell-surface flex min-h-0 flex-1 flex-col overflow-hidden border-accent/10 md:rounded-2xl md:border md:shadow-sm">
                    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-accent/10 px-4" style={{ background: 'var(--sidebar-surface)' }}>
                        <div className="flex min-w-0 items-center gap-3">
                            {/* Mobile: open overlay */}
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/[0.07] hover:text-ink md:hidden"
                            >
                                <Menu className="h-4 w-4" />
                            </button>
                            {/* Desktop: collapse toggle */}
                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
                                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/[0.07] hover:text-ink md:flex"
                            >
                                {sidebarCollapsed ? (
                                    <ChevronsRight className="h-4 w-4" />
                                ) : (
                                    <ChevronsLeft className="h-4 w-4" />
                                )}
                            </button>
                            <div className="hidden h-4 w-px bg-ink/15 md:block" />
                            <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent md:flex">
                                <Bot className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 [&_h2]:truncate [&_h2]:font-manrope [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:text-ink/48">
                                {header ?? (
                                    <h2 className="text-sm font-semibold uppercase tracking-widest text-ink/48">
                                        {appName}
                                    </h2>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <HeaderClock />
                            <InternalChat />
                            <button
                                type="button"
                                onClick={toggleTheme}
                                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/[0.08] text-ink/50 transition hover:bg-ink/[0.07] hover:text-ink"
                            >
                                {theme === 'dark' ? (
                                    <Sun className="h-4 w-4" />
                                ) : (
                                    <Moon className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="hidden"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    <main className="min-h-0 flex-1 flex flex-col overflow-hidden">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
