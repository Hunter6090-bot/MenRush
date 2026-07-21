export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Bind to CSS vars so light/dark/system (html[data-theme]) applies everywhere.
        nn: {
          bg: 'var(--nn-bg)',
          card: 'var(--nn-card)',
          elevated: 'var(--nn-elevated)',
          copper: 'var(--nn-copper)',
          'copper-bright': 'var(--nn-copper-bright)',
          rust: 'var(--nn-rust)',
          'on-copper': 'var(--nn-on-copper)',
          'danger-light': 'var(--nn-danger-light)',
          border: 'var(--nn-border)',
          text: 'var(--nn-text)',
          muted: 'var(--nn-muted)',
          faint: 'var(--nn-faint)',
          online: 'var(--nn-online)',
          warning: 'var(--nn-warning)',
          danger: 'var(--nn-danger)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'radar-1': 'radarPulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'radar-2': 'radarPulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) 0.8s infinite',
        'radar-3': 'radarPulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) 1.6s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        radarPulse: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(3.5)', opacity: '0' },
        },
      },
      boxShadow: {
        card: 'var(--nn-shadow-card)',
        'card-hover': 'var(--nn-shadow-card-hover)',
        'glow-copper': 'var(--nn-glow-copper)',
        'glow-rust': 'var(--nn-glow-rust)',
      },
    },
  },
  plugins: [],
};
