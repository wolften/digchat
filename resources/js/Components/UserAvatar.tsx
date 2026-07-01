import { userInitials } from '@/lib/userInitials';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const SIZE_CLASSES = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-10 w-10 text-xs',
} as const;

export type UserAvatarSize = keyof typeof SIZE_CLASSES;

interface UserAvatarProps {
    name: string;
    photoUrl?: string | null;
    size?: UserAvatarSize;
    className?: string;
    /** Usado dentro do wrapper da lista de conversas (Atendimento / Chat Interno). */
    embedded?: boolean;
}

export function UserAvatar({
    name,
    photoUrl,
    size = 'md',
    className,
    embedded = false,
}: UserAvatarProps) {
    const sizeClass = SIZE_CLASSES[size];
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [photoUrl]);

    if (photoUrl && !imageFailed) {
        if (embedded) {
            return (
                <img
                    src={photoUrl}
                    alt=""
                    loading="lazy"
                    onError={() => setImageFailed(true)}
                    className={cn('h-full w-full object-cover', className)}
                />
            );
        }

        return (
            <img
                src={photoUrl}
                alt=""
                loading="lazy"
                onError={() => setImageFailed(true)}
                className={cn(
                    'shrink-0 rounded-full border border-accent/25 bg-accent/10 object-cover',
                    sizeClass,
                    className,
                )}
            />
        );
    }

    if (embedded) {
        return (
            <div
                className={cn(
                    'flex h-full w-full items-center justify-center text-xs font-semibold text-accent',
                    className,
                )}
            >
                {userInitials(name) || 'DC'}
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10 font-manrope font-bold text-accent',
                sizeClass,
                className,
            )}
        >
            {userInitials(name) || 'DC'}
        </div>
    );
}