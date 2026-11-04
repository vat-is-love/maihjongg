// SPDX-FileCopyrightText: 2026 Nephrite contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Tile artwork: Postmodern from GNOME Mahjongg, © 2004–2025 Mahjongg Contributors, GPL-3.0-or-later.
// App icons below: © 2026 Nephrite contributors.
export const FACE_NAMES = [
  ...Array.from({ length: 9 }, (_, i) => `Круги: ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `Бамбук: ${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `Символы: ${i + 1}`),
  'Восточный ветер', 'Южный ветер', 'Западный ветер', 'Северный ветер',
  'Красный дракон', 'Зелёный дракон', 'Белый дракон', 'Цветы', 'Времена года',
];
// Atlas cells and geometry follow GNOME Mahjongg's Postmodern theme.
// The source file is kept intact in public/themes with its GPL attribution.
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 88;
export const TILE_PITCH_X = 56;
export const TILE_PITCH_Y = 80;
export const TILE_LAYER_X = 8;
export const TILE_LAYER_Y = 8;
const FACE_COLUMNS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
  24, 25, 26, 27, 28, 29, 30, 31, 32,
  15, 16, 17, 18, 19, 20, 21, 22, 23,
  12, 11, 10, 9, 13, 14, 37, 38, 33,
];
export function tileColumn(face: number, variant = 0): number {
  return FACE_COLUMNS[face] + (face >= 34 ? variant % 4 : 0);
}
export function tileSprite(face: number, variant: number): string {
  const x = tileColumn(face, variant) * TILE_WIDTH;
  // Lossless 2× raster atlas, displayed in the original logical coordinates.
  // All crops share one decoded bitmap; Board reveals them together.
  return [false, true].map(highlighted => `<svg class="tile-sprite ${highlighted ? 'tile-sprite-highlight' : 'tile-sprite-normal'}" viewBox="${x} ${highlighted ? TILE_HEIGHT : 0} ${TILE_WIDTH} ${TILE_HEIGHT}" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" overflow="hidden" pointer-events="none"><image href="${import.meta.env.BASE_URL}themes/postmodern.webp" width="2752" height="176"/></svg>`).join('');
}
export function icon(name: string, size = 22): string {
  const paths: Record<string, string> = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    fit: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M2 9V2h7m6 0h7v7M2 15v7h7m6 0h7v-7"/>',
    fullscreen: '<path d="M8 3H3v5m0 -5 6 6m7 -6h5v5m0 -5-6 6M3 16v5h5m-5 0 6-6m12 1v5h-5m5 0-6-6"/>',
    collapse: '<path d="M3 8h5V3M8 8 2 2m14 1v5h5m-5 0 6-6M3 16h5v5m0 -5-6 6m14 -1v-5h5m-5 0 6 6"/>',
    undo: '<path d="M9 5L4 10l5 5M4 10h9a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
    redo: '<path d="M15 5l5 5-5 5m5 -5h-9a6 6 0 0 0 0 12" transform="translate(0 -2)"/>',
    hint: '<path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0L15 17H9z"/>',
    shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4 -4l4 4-4 4M3 18h3c2 0 3 -2 5 -5m3 -5c1 -1 2 -2 4 -2h3m-4 -4l4 4-4 4"/>',
    leaf: '<path d="M20 3C7 1 1 9 6 15s16 1 14-12ZM5 21l10-12"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.7m0 3h.01"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
    download: '<path d="M12 3v12m-5 -5l5 5 5-5M4 16v5h16v-5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M9 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    check: '<path d="M5 12l4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 1h8"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`;
}
