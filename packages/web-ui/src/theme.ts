import { palette, lightPalette, radii } from '../../../apps/mobile/src/theme/palette';

function variables(colors: typeof palette) {
  return Object.entries({ bg: colors.bg, surface: colors.surface, field: colors.surface2,
    border: colors.border, text: colors.text, muted: colors.textMuted, accent: colors.accent,
    'radius-field': `${radii.field}px`, 'radius-card': `${radii.card}px`,
  }).map(([name, value]) => `--stc-${name}:${value}`).join(';');
}
export const themeCss = `html.stc-modern{${variables(palette)};color-scheme:dark}
html.stc-modern[data-stc-theme="light"]{${variables(lightPalette)};color-scheme:light}`;
