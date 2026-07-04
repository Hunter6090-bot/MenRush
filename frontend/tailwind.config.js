export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cinzel', 'Trajan Pro', 'Cormorant Garamond', 'serif'],
      },
      colors: {
        nn: {
          bg: '#0D0A06',
          card: '#1E1508',
          elevated: '#2A1C0A',
          copper: '#C4832A',
          'copper-bright': '#E0A14A',
          rust: '#8B4513',
          border: '#3D2B0E',
          text: '#F0E0C0',
          muted: '#A89070',
          faint: '#6B5840',
          online: '#6FA85A',
          warning: '#D4A24C',
          danger: '#B0432E',
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
        card: '0 4px 24px rgba(0,0,0,0.55)',
        'card-hover': '0 16px 48px rgba(0,0,0,0.75)',
        'glow-copper': '0 0 28px rgba(196,131,42,0.35)',
        'glow-rust': '0 0 28px rgba(139,69,19,0.40)',
      },
    },
  },
  plugins: [],
};
