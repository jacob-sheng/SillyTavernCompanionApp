// Single source of truth for the design system's raw color + radius values.
// Consumed by BOTH tailwind.config.js (build-time className tokens) and
// src/theme/tokens.ts (runtime values for non-className APIs).
//
// Refined Dark (Cinema): deep near-black, one violet accent, fine borders, subtle depth.
// Both native screens and the injected web shell consume these semantic values.

const palette = {
  bg: '#0B0B0F', // app background (darkest)
  surface: '#15151C', // cards, headers, sheets
  surface2: '#1E1E28', // inputs, nested / pressed surfaces
  surface3: '#2A2A36', // hovered / highest surface
  border: '#23232E', // hairline dividers
  borderStrong: '#33333F', // emphasized borders

  text: '#F5F5F7', // primary text  (>= 12:1 on bg)
  textMuted: '#9A9AA8', // secondary text (>= 4.6:1 on surface)
  textSubtle: '#6B6B78', // placeholders, faint meta

  accent: '#7C5CFF', // single brand accent (violet)
  accentPressed: '#6A4AE0', // accent pressed state
  accentSoft: 'rgba(124,92,255,0.14)', // accent tint backgrounds
  onAccent: '#FFFFFF', // text/icons on accent

  danger: '#F26D6D',
  dangerSoft: 'rgba(242,109,109,0.14)',
  success: '#46C68A',
  warning: '#E0A458',

  userBubble: '#20283F', // user message bubble (cool tint)
  charBubble: '#211B30', // character message bubble (violet tint)

  scrim: 'rgba(0,0,0,0.6)', // modal / sheet backdrop
};

// Radius scale (custom names avoid colliding with Tailwind's core rounded-* utilities).
const radii = { field: 14, card: 18, sheet: 28, pill: 9999 };

const lightPalette = {
  ...palette, bg: '#FAFAFC', surface: '#FFFFFF', surface2: '#F0F0F5', surface3: '#E8E8F0',
  border: '#DEDEE7', borderStrong: '#C6C6D2', text: '#20202A', textMuted: '#636374', textSubtle: '#717184',
  accent: '#6450C7', accentPressed: '#5340B1', userBubble: '#EDEAFB', charBubble: '#F3F1F8',
};

module.exports = { palette, lightPalette, radii };
