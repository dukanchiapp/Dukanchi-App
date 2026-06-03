// ──────────────────────────────────────────────────────────────
// Dukanchi Bright Skin — Tailwind theme extension
// Merge this `extend` block into your tailwind.config.{js,ts}
// so utilities like bg-brand, text-ink, shadow-card, font-display
// map to the EXACT approved values.
// ──────────────────────────────────────────────────────────────
module.exports = {
  theme: {
    extend: {
      colors: {
        // Brand — Blinkit-style YELLOW (default/shipping theme)
        brand:   { DEFAULT: '#FFB300', magenta: '#EA9A00', ink: '#C77E00' },
        blue:    { DEFAULT: '#2563EB', bg: '#E8F0FE' },
        green:   { DEFAULT: '#0C831F', bg: '#E8F5E9' },
        amber:   { DEFAULT: '#F0B429' },
        danger:  { DEFAULT: '#E53935', bg: '#FDECEA' },
        ink:     '#1C1A18',
        gray1:   '#3A3633',
        gray2:   '#7E7873',
        gray3:   '#A8A29C',
        line:    '#ECE7DF',
        surface: '#FAFAF7',
        tint:    '#FFF6DD',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
      },
      borderRadius: { card: '22px', tile: '17px', pill: '9999px' },
      boxShadow: {
        e1:   '0 1px 2px rgba(28,20,12,0.04)',
        e2:   '0 4px 16px rgba(28,20,12,0.06), 0 1px 3px rgba(28,20,12,0.04)',
        card: '0 2px 10px rgba(28,20,12,0.05)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #FFD63B 0%, #FFB300 100%)',
      },
      transitionTimingFunction: { brand: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    },
  },
};
