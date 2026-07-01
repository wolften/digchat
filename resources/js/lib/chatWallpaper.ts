function svgDataUri(svg: string): string {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function color(accentRgb: string, opacity: number): string {
    const [r, g, b] = accentRgb.split(' ');

    return `rgba(${r},${g},${b},${opacity})`;
}

type WallpaperOptions = {
    strokeWidth?: number;
    fillOpacityFactor?: number;
    dotOpacity?: number;
};

/**
 * WhatsApp / Telegram-style doodle wallpaper tile.
 * Uses stroke-based line art scattered across a large tile.
 */
export function chatWallpaperPattern(
    accentRgb: string,
    opacity: number,
    options: WallpaperOptions = {},
): string {
    const strokeWidth = options.strokeWidth ?? 1.15;
    const fillOpacityFactor = options.fillOpacityFactor ?? 0.55;
    const dotOpacity = options.dotOpacity ?? 0.85;
    const stroke = color(accentRgb, opacity);
    const fill = color(accentRgb, opacity * fillOpacityFactor);
    const s = 'stroke-linecap="round" stroke-linejoin="round"';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <g fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${s}>
    <g transform="translate(28 36) rotate(-12)">
      <rect x="2" y="2" width="34" height="24" rx="7"/>
      <path d="M10 26 L4 32 L10 26"/>
    </g>
    <g transform="translate(196 28) rotate(8)">
      <path d="M12 6 C12 2 20 0 20 8 C20 0 28 2 28 10 C28 18 20 24 20 24 C20 24 12 18 12 10 Z"/>
    </g>
    <g transform="translate(108 18) rotate(5)">
      <circle cx="14" cy="14" r="12"/>
      <path d="M14 8 L14 14 L18 18"/>
    </g>
    <g transform="translate(252 88) rotate(-6)">
      <path d="M14 2 L17 10 L26 10 L19 16 L22 26 L14 20 L6 26 L9 16 L2 10 L11 10 Z"/>
    </g>
    <g transform="translate(42 128) rotate(10)">
      <rect x="4" y="8" width="28" height="20" rx="3"/>
      <circle cx="18" cy="18" r="5"/>
      <path d="M4 8 L18 2 L32 8"/>
    </g>
    <g transform="translate(168 108) rotate(-15)">
      <path d="M8 4 L8 22 M8 22 C8 26 20 26 20 22 L20 4 C20 0 8 0 8 4"/>
      <path d="M14 22 L14 26"/>
    </g>
    <g transform="translate(268 168) rotate(12)">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="9" cy="11" r="1.2" fill="${fill}" stroke="none"/>
      <circle cx="15" cy="11" r="1.2" fill="${fill}" stroke="none"/>
      <path d="M8 16 Q12 19 16 16"/>
    </g>
    <g transform="translate(18 208) rotate(-8)">
      <rect x="2" y="6" width="30" height="20" rx="2"/>
      <path d="M2 6 L16 0 L32 6"/>
    </g>
    <g transform="translate(118 188) rotate(6)">
      <path d="M2 8 L16 2 L30 8 L30 24 L2 24 Z"/>
      <path d="M2 8 L16 14 L30 8"/>
    </g>
    <g transform="translate(218 218) rotate(-10)">
      <path d="M4 4 L4 20 L12 28 L12 20"/>
      <path d="M12 20 L28 20 L28 4 L12 4"/>
      <path d="M16 12 L22 16 L16 20"/>
    </g>
    <g transform="translate(78 268) rotate(14)">
      <path d="M12 2 C6 2 2 8 2 14 C2 22 12 30 12 30 C12 30 22 22 22 14 C22 8 18 2 12 2"/>
      <circle cx="12" cy="13" r="3"/>
    </g>
    <g transform="translate(188 278) rotate(-5)">
      <path d="M6 4 L26 4 M6 12 L22 12 M6 20 L18 20"/>
    </g>
    <g transform="translate(288 248) rotate(18)">
      <path d="M4 16 L12 4 L20 16"/>
      <path d="M8 12 L16 12"/>
    </g>
    <g transform="translate(148 58) rotate(-20)">
      <path d="M4 10 L14 4 L24 10 L24 22 L4 22 Z"/>
      <path d="M10 14 L18 14 M10 18 L16 18"/>
    </g>
    <g transform="translate(58 78) rotate(7)">
      <path d="M6 6 L26 6 L26 22 L6 22 Z" rx="2"/>
      <path d="M10 12 L20 12 M10 16 L17 16"/>
    </g>
    <g transform="translate(238 38) rotate(-8)">
      <circle cx="10" cy="10" r="8"/>
      <path d="M6 10 L9 13 L14 7"/>
    </g>
    <g transform="translate(298 108) rotate(6)">
      <path d="M8 4 C4 4 2 10 2 14 C2 18 6 22 10 22 L10 26 L14 22 C18 22 22 18 22 14 C22 10 20 4 16 4"/>
    </g>
    <g transform="translate(8 158) rotate(-14)">
      <path d="M14 4 L18 12 L26 12 L20 18 L22 26 L14 21 L6 26 L8 18 L2 12 L10 12 Z"/>
    </g>
    <g transform="translate(128 128) rotate(3)">
      <circle cx="14" cy="14" r="11"/>
      <path d="M10 14 L13 17 L19 11"/>
    </g>
    <g transform="translate(278 288) rotate(-12)">
      <rect x="2" y="4" width="24" height="18" rx="5"/>
      <path d="M8 22 L4 28 L8 22"/>
    </g>
    <g transform="translate(48 48) rotate(16)">
      <path d="M4 20 L12 4 L20 20"/>
      <path d="M7 15 L17 15"/>
    </g>
  </g>
  <g fill="${fill}" stroke="none" opacity="${dotOpacity}">
    <circle cx="90" cy="290" r="2"/>
    <circle cx="210" cy="12" r="2"/>
    <circle cx="305" cy="198" r="2"/>
    <circle cx="15" cy="95" r="2"/>
    <circle cx="160" cy="248" r="2"/>
    <circle cx="245" cy="138" r="2"/>
  </g>
</svg>`;

    return svgDataUri(svg);
}

/** Padrão para fundos claros — traços na cor accent do tema. */
export function chatWallpaperPatternLight(accentRgb: string): string {
    return chatWallpaperPattern(accentRgb, 0.22, {
        strokeWidth: 1.45,
        fillOpacityFactor: 0.8,
        dotOpacity: 1,
    });
}