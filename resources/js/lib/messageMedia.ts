export type MediaMessageType = 'image' | 'video' | 'audio' | 'document';

const MEDIA_PLACEHOLDER_TO_TYPE: Record<string, MediaMessageType> = {
    '[image]': 'image',
    '[imagem]': 'image',
    '[video]': 'video',
    '[audio]': 'audio',
    '[document]': 'document',
    '[documento]': 'document',
};

function normalizePlaceholder(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function isMediaMessageType(type: string | null | undefined): type is MediaMessageType {
    return type === 'image' || type === 'video' || type === 'audio' || type === 'document';
}

export function mediaTypeFromPlaceholder(body: string | null | undefined): MediaMessageType | null {
    if (!body) return null;

    return MEDIA_PLACEHOLDER_TO_TYPE[normalizePlaceholder(body)] ?? null;
}

export function mediaCaption(body: string | null | undefined, type: string | null | undefined): string | null {
    const caption = body?.trim();

    if (!caption) return null;

    if (mediaTypeFromPlaceholder(caption) && (!type || isMediaMessageType(type))) {
        return null;
    }

    return caption;
}
