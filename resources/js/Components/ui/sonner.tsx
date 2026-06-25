import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:border-accent/20 group-[.toaster]:bg-base/95 group-[.toaster]:text-ink group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-xl',
                    description: 'group-[.toast]:text-ink/55',
                    actionButton: 'group-[.toast]:bg-accent group-[.toast]:text-canvas',
                    cancelButton: 'group-[.toast]:bg-ink/[0.08] group-[.toast]:text-ink/70',
                },
            }}
            {...props}
        />
    );
};

export { Toaster };
