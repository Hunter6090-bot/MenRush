export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        nn: {
          bg: '#0F1115',
          card: '#1A1D23',
          elevated: '#21252D',
          blue: '#4F8CFF',
          coral: '#FF6B6B',
          text: '#F2F4F8',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'radar-1': 'radarPulse 2.4s ease-out infinite',
        'radar-2': 'radarPulse 2.4s ease-out 0.8s infinite',
        'radar-3': 'radarPulse 2.4s ease-out 1.6s infinite',
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
        card: '0 4px 24px rgba(0,0,0,0.5)',
        'card-hover': '0 12px 48px rgba(0,0,0,0.7)',
        'glow-blue': '0 0 32px rgba(79,140,255,0.35)',
        'glow-coral': '0 0 32px rgba(255,107,107,0.35)',
      },
    },
  },
  plugins: [],
};
