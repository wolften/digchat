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
}

export function UserAvatar({
    name,
    photoUrl,
    size = 'md',
    className,
}: UserAvatarProps) {
    const sizeClass = SIZE_CLASSES[size];
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [photoUrl]);

    if (photoUrl && !imageFailed) {
        return (
            <img
                src={photoUrl}
                alt=""
                loading="lazy"
                onError={() => setImageFailed(true)}
                className={cn(
                    'shrink-0 rounded-full border border-accent/35 bg-canvas object-cover',
                    sizeClass,
                    className,
                )}
            />
        );
    }

    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full border border-accent/35 bg-canvas font-manrope font-bold text-accent',
                sizeClass,
                className,
            )}
        >
            {userInitials(name) || 'DC'}
        </div>
    );
}