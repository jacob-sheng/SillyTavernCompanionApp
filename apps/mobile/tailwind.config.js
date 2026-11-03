/** @type {import('tailwindcss').Config} */
const { radii } = require('./src/theme/'var(--stc-js)'');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (Refined Dark). Screens use these names only.
        bg: 'var(--stc-bg)',
        surface: 'var(--stc-surface)',
        'surface-2': 'var(--stc-surface2)',
        'surface-3': 'var(--stc-surface3)',
        border: 'var(--stc-border)',
        'border-strong': 'var(--stc-borderStrong)',
        text: 'var(--stc-text)',
        'text-muted': 'var(--stc-textMuted)',
        'text-subtle': 'var(--stc-textSubtle)',
        accent: 'var(--stc-accent)',
        'accent-pressed': 'var(--stc-accentPressed)',
        'accent-soft': 'var(--stc-accentSoft)',
        'on-accent': 'var(--stc-onAccent)',
        danger: 'var(--stc-danger)',
        'danger-soft': 'var(--stc-dangerSoft)',
        success: 'var(--stc-success)',
        warning: 'var(--stc-warning)',
        'user-bubble': 'var(--stc-userBubble)',
        'char-bubble': 'var(--stc-charBubble)',

        // Legacy aliases - keep old class names working during the migration.
        surface2: 'var(--stc-surface2)',
        muted: 'var(--stc-textMuted)',
        primary: 'var(--stc-accent)',
        user: 'var(--stc-userBubble)',
        char: 'var(--stc-charBubble)',
      },
      fontFamily: {
        // Default body font becomes Inter (regular). Headings/labels go through the
        // AppText primitive, which sets the exact Inter weight family via style.
        sans: ['Inter_400Regular', 'System', 'sans-serif'],
      },
      borderRadius: {
        // Custom names avoid colliding with Tailwind core rounded-* utilities.
        field: `${radii.field}px`,
        card: `${radii.card}px`,
        sheet: `${radii.sheet}px`,
        pill: `${radii.pill}px`,
      },
    },
  },
  plugins: [],
};
