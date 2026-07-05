/* @ds-bundle: {"format":4,"namespace":"MenRushDesignSystem_aeac44","components":[],"sourceHashes":{"ui_kits/menrush_app/auth.jsx":"4ec3c714f309","ui_kits/menrush_app/components.jsx":"0dce8c695782","ui_kits/menrush_app/ios-frame.jsx":"d67eb3ffe562","ui_kits/menrush_app/modals.jsx":"b91cc08ddcc2","ui_kits/menrush_app/rooms.jsx":"45edc2603408","ui_kits/menrush_app/screens.jsx":"7cd3ca98217d","ui_kits/menrush_app/verify.jsx":"6cf4e90df615"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MenRushDesignSystem_aeac44 = window.MenRushDesignSystem_aeac44 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/menrush_app/auth.jsx
try { (() => {
// MenRush — auth flow screens.
// Login, Register, ForgotPassword, ResetPassword
// Pattern matches the legacy repo's Login/Register: full-bleed photography background slideshow,
// 55% black overlay, glass card centered. Same shape, copper-rebranded.
// Globals: MR_PALETTE, Icon, Button, PulsingAvatar

const AUTH_BG_IMAGES = ['../../assets/photos/01-rooftop-skyline-bears.jpeg',
// late rooftop, city, mixed bodies
'../../assets/photos/02-soho-night-crowd.jpeg',
// soho neon, crowd
'../../assets/photos/04-leather-harness-bears.jpeg',
// leather + bear + smile
'../../assets/photos/16-amsterdam-neon-night.jpeg',
// amsterdam wet street
'../../assets/photos/22-daddy-twink-bar.jpeg',
// intimate pair in bar
'../../assets/photos/27-golden-beach-sunset.jpeg',
// warm beach, light counterbalance
'../../assets/photos/31-london-rooftop-dusk.jpeg',
// dusk rooftop, sweat
'../../assets/photos/36-wet-street-bar-line.jpeg',
// rain + bar line
'../../assets/photos/41-twink-jock-neon-street.jpeg',
// two men, neon
'../../assets/photos/47-rooftop-berlin-night.jpeg' // berlin rooftop dusk
];

// One photo per session — picked at random on load, then static (no slideshow).
function useAuthBg() {
  const [i] = React.useState(() => Math.floor(Math.random() * AUTH_BG_IMAGES.length));
  return {
    src: AUTH_BG_IMAGES[i],
    fade: true
  };
}

// Shared auth shell
function AuthShell({
  children
}) {
  const {
    src,
    fade
  } = useAuthBg();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      zIndex: 50,
      background: MR_PALETTE.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: fade ? 1 : 0,
      transition: 'opacity .7s ease',
      filter: 'saturate(1.05) brightness(0.95)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(180deg, rgba(13,10,6,.5) 0%, rgba(13,10,6,.75) 60%, rgba(13,10,6,.92) 100%)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      maxWidth: 360,
      animation: 'nn-slide-up .45s cubic-bezier(.16,1,.3,1)'
    }
  }, children));
}
const authInput = {
  width: '100%',
  background: 'rgba(13,10,6,.5)',
  border: `1px solid ${MR_PALETTE.border}`,
  color: MR_PALETTE.text,
  padding: '14px 16px',
  borderRadius: 12,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box'
};
const authLabel = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: MR_PALETTE.muted,
  textTransform: 'uppercase',
  marginBottom: 6
};
function AuthBranding({
  tagline = 'See who\'s near you right now.'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.png",
    alt: "MenRush",
    style: {
      width: 86,
      height: 86,
      borderRadius: '24%',
      boxShadow: '0 12px 32px rgba(0,0,0,.6)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '14px 0 4px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 26,
      fontWeight: 900,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, "MENRUSH"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: MR_PALETTE.muted,
      margin: 0,
      letterSpacing: '0.02em'
    }
  }, tagline));
}
function AuthCard({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(30,21,8,.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 20,
      padding: 22,
      boxShadow: '0 24px 80px rgba(0,0,0,.7)'
    }
  }, children);
}

// ── Login ───────────────────────────────────────────────────
function LoginScreen({
  onSubmit,
  onRegister,
  onForgot
}) {
  const [email, setEmail] = React.useState('marcus@menrush.app');
  const [password, setPassword] = React.useState('');
  return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(AuthBranding, null), /*#__PURE__*/React.createElement(AuthCard, null, /*#__PURE__*/React.createElement("h2", {
    style: authH2
  }, "Welcome back"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "EMAIL"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: email,
    onChange: e => setEmail(e.target.value),
    type: "email"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "PASSWORD"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: password,
    onChange: e => setPassword(e.target.value),
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onForgot,
    style: authLinkBtn
  }, "Forgot password?")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onSubmit
  }, "SIGN IN")), /*#__PURE__*/React.createElement("p", {
    style: authFoot
  }, "No account? ", /*#__PURE__*/React.createElement("button", {
    onClick: onRegister,
    style: authInlineLink
  }, "Create one"))));
}

// ── Register ────────────────────────────────────────────────
function RegisterScreen({
  onSubmit,
  onSignIn
}) {
  const [form, setForm] = React.useState({
    name: 'Marcus',
    email: '',
    age: '',
    password: ''
  });
  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.value
  }));
  return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(AuthBranding, {
    tagline: "No waiting. No swiping. Just men nearby."
  }), /*#__PURE__*/React.createElement(AuthCard, null, /*#__PURE__*/React.createElement("h2", {
    style: authH2
  }, "Create account"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "NAME"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: form.name,
    onChange: set('name'),
    placeholder: "What men will call you"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "EMAIL"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: form.email,
    onChange: set('email'),
    type: "email",
    placeholder: "you@example.com"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "AGE"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: form.age,
    onChange: set('age'),
    type: "number",
    placeholder: "25"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "PASSWORD"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: form.password,
    onChange: set('password'),
    type: "password",
    placeholder: "Min 8 chars"
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: MR_PALETTE.faint,
      lineHeight: 1.5,
      margin: '4px 0 4px'
    }
  }, "By creating an account you confirm you're 18+ and agree to the\xA0", /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.copper
    }
  }, "Community Guidelines"), "."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onSubmit
  }, "CREATE ACCOUNT")), /*#__PURE__*/React.createElement("p", {
    style: authFoot
  }, "Already a member? ", /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: authInlineLink
  }, "Sign in"))));
}

// ── Forgot password ─────────────────────────────────────────
function ForgotScreen({
  onSubmit,
  onBack
}) {
  const [email, setEmail] = React.useState('');
  return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(AuthBranding, {
    tagline: "We'll send you a reset link."
  }), /*#__PURE__*/React.createElement(AuthCard, null, /*#__PURE__*/React.createElement("h2", {
    style: authH2
  }, "Reset password"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: MR_PALETTE.muted,
      lineHeight: 1.5,
      margin: '0 0 14px'
    }
  }, "Enter the email tied to your account. We'll send a link."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "EMAIL"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: email,
    onChange: e => setEmail(e.target.value),
    type: "email",
    placeholder: "you@example.com"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onSubmit
  }, "SEND RESET LINK")), /*#__PURE__*/React.createElement("p", {
    style: authFoot
  }, "Remembered it? ", /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: authInlineLink
  }, "Back to sign in"))));
}

// ── Reset password (after clicking link) ────────────────────
function ResetScreen({
  onSubmit,
  onBack
}) {
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const matches = p1.length >= 8 && p1 === p2;
  return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement(AuthBranding, {
    tagline: "Set a new password."
  }), /*#__PURE__*/React.createElement(AuthCard, null, /*#__PURE__*/React.createElement("h2", {
    style: authH2
  }, "New password"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "NEW PASSWORD"), /*#__PURE__*/React.createElement("input", {
    style: authInput,
    value: p1,
    onChange: e => setP1(e.target.value),
    type: "password",
    placeholder: "Min 8 chars"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: authLabel
  }, "CONFIRM"), /*#__PURE__*/React.createElement("input", {
    style: {
      ...authInput,
      borderColor: p2 && !matches ? MR_PALETTE.danger : MR_PALETTE.border
    },
    value: p2,
    onChange: e => setP2(e.target.value),
    type: "password",
    placeholder: "Repeat it"
  }), p2 && !matches && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#C46A53',
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 11,
    strokeWidth: 2.5
  }), " Passwords don't match"), matches && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#8FC773',
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 2.5
  }), " Match")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onSubmit,
    disabled: !matches
  }, "SAVE & SIGN IN")), /*#__PURE__*/React.createElement("p", {
    style: authFoot
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: authInlineLink
  }, "Back to sign in"))));
}
const authH2 = {
  margin: '0 0 14px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '0.02em',
  color: MR_PALETTE.text
};
const authFoot = {
  textAlign: 'center',
  marginTop: 18,
  marginBottom: 0,
  fontSize: 12,
  color: MR_PALETTE.muted
};
const authInlineLink = {
  background: 'transparent',
  border: 0,
  color: MR_PALETTE.copper,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600
};
const authLinkBtn = {
  ...authInlineLink,
  padding: '4px 0',
  marginTop: -4
};
Object.assign(window, {
  LoginScreen,
  RegisterScreen,
  ForgotScreen,
  ResetScreen,
  AuthShell,
  AuthBranding,
  AuthCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/auth.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/components.jsx
try { (() => {
// MenRush — small UI components.
// All export to window so screens.jsx can use them.
// Stick to inline styles + token references; never hardcode hex outside this file's "PALETTE" object.

const MR_PALETTE = {
  bg: '#0D0A06',
  card: '#1E1508',
  elevated: '#2A1C0A',
  border: '#3D2B0E',
  copper: '#C4832A',
  copperBright: '#E0A14A',
  rust: '#8B4513',
  text: '#F0E0C0',
  muted: '#A89070',
  faint: '#6B5840',
  online: '#6FA85A',
  danger: '#B0432E',
  warning: '#D4A24C'
};

// ── Icons ────────────────────────────────────────────────────
// Inline SVG, 2px stroke, currentColor, rounded — matches in-house style.
const Icon = ({
  name,
  size = 20,
  strokeWidth = 2,
  style
}) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style
  };
  switch (name) {
    case 'pulse':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "6"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }));
    case 'compass':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("polygon", {
        points: "16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88",
        fill: "currentColor",
        stroke: "none"
      }));
    case 'flame':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-5 2 1 3 0 3-4z"
      }));
    case 'chat':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M21 12c0 4.4-4 8-9 8a9.9 9.9 0 0 1-4.3-1L3 20l1.4-3.7C3.5 15 3 13.6 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"
      }));
    case 'user':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "8",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"
      }));
    case 'filter':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M3 4h18l-7 9v7l-4-2v-5z"
      }));
    case 'send':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M3 11l18-8-8 18-2.5-7.5z"
      }));
    case 'pin':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"
      }));
    case 'check':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("polyline", {
        points: "20 6 9 17 4 12"
      }));
    case 'x':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("line", {
        x1: "6",
        y1: "6",
        x2: "18",
        y2: "18"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "18",
        y1: "6",
        x2: "6",
        y2: "18"
      }));
    case 'chevron-left':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("polyline", {
        points: "15 18 9 12 15 6"
      }));
    case 'chevron-down':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("polyline", {
        points: "6 9 12 15 18 9"
      }));
    case 'more':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "5",
        cy: "12",
        r: "1.6"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "1.6"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "19",
        cy: "12",
        r: "1.6"
      }));
    case 'video':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "6",
        width: "14",
        height: "12",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M17 10l4-3v10l-4-3z",
        fill: "currentColor"
      }));
    case 'shield-check':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"
      }), /*#__PURE__*/React.createElement("polyline", {
        points: "9 12 11 14 15 10"
      }));
    case 'sparkle':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"
      }));
    case 'globe':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 12h20M12 2c3 4 3 16 0 20M12 2c-3 4-3 16 0 20"
      }));
    case 'camera':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "13",
        r: "4"
      }));
    case 'image':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "8.5",
        cy: "8.5",
        r: "1.5"
      }), /*#__PURE__*/React.createElement("polyline", {
        points: "21 15 16 10 5 21"
      }));
    case 'mic':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("rect", {
        x: "9",
        y: "2",
        width: "6",
        height: "12",
        rx: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"
      }));
    case 'play':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M7 4l13 8-13 8z"
      }));
    case 'pause':
      return /*#__PURE__*/React.createElement("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "6",
        y: "4",
        width: "4",
        height: "16",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "14",
        y: "4",
        width: "4",
        height: "16",
        rx: "1"
      }));
    case 'lock':
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("rect", {
        x: "4",
        y: "11",
        width: "16",
        height: "10",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 11V7a4 4 0 0 1 8 0v4"
      }));
    default:
      return null;
  }
};

// ── Avatar with optional radar pulse ─────────────────────────
function PulsingAvatar({
  name,
  photoUrl,
  pulsing = false,
  online = false,
  verified = false,
  size = 56,
  ringColor = MR_PALETTE.copper
}) {
  const initial = (name || '?')[0].toUpperCase();
  const wrapSize = pulsing ? size * 1.5 : size;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: wrapSize,
      height: wrapSize,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, pulsing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r1",
    style: {
      inset: (wrapSize - size) / 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r2",
    style: {
      inset: (wrapSize - size) / 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r3",
    style: {
      inset: (wrapSize - size) / 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      background: `linear-gradient(160deg, ${MR_PALETTE.elevated}, ${MR_PALETTE.card})`,
      border: `2px solid ${ringColor}`,
      boxShadow: `0 0 0 3px ${ringColor}22, 0 4px 16px rgba(0,0,0,.5)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: MR_PALETTE.text,
      fontWeight: 700,
      fontSize: size * 0.35
    }
  }, photoUrl ? /*#__PURE__*/React.createElement("img", {
    src: photoUrl,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initial), verified && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: pulsing ? '20%' : -2,
      right: pulsing ? '20%' : -2,
      width: size * 0.32,
      height: size * 0.32,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      border: `2px solid ${MR_PALETTE.bg}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
      boxShadow: `0 0 12px ${MR_PALETTE.copper}88`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: size * 0.18,
    strokeWidth: 3,
    style: {
      color: '#1A0E03'
    }
  })), online && !verified && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: pulsing ? '22%' : 0,
      right: pulsing ? '22%' : 0,
      width: size * 0.26,
      height: size * 0.26,
      borderRadius: '50%',
      background: MR_PALETTE.online,
      boxShadow: `0 0 10px ${MR_PALETTE.online}`,
      border: `2.5px solid ${MR_PALETTE.bg}`,
      zIndex: 3
    }
  }));
}

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({
  online,
  lastSeen,
  pulsing,
  size = 'sm',
  dotOnly = false
}) {
  if (dotOnly) {
    const c = pulsing ? MR_PALETTE.copper : online ? MR_PALETTE.online : MR_PALETTE.muted;
    return /*#__PURE__*/React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'rgba(13,10,6,.6)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${MR_PALETTE.border}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: c,
        opacity: pulsing || online ? 1 : .5,
        boxShadow: pulsing || online ? `0 0 8px ${c}` : 'none'
      }
    }));
  }
  if (pulsing) {
    return /*#__PURE__*/React.createElement("span", {
      style: badgeStyle({
        bg: MR_PALETTE.copper,
        fg: '#1A0E03',
        glow: true,
        bold: true,
        size
      })
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#1A0E03'
      }
    }), "PULSING");
  }
  if (online) {
    return /*#__PURE__*/React.createElement("span", {
      style: badgeStyle({
        bg: 'rgba(111,168,90,.13)',
        fg: '#8FC773',
        border: 'rgba(111,168,90,.35)',
        size
      })
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: MR_PALETTE.online,
        boxShadow: `0 0 8px ${MR_PALETTE.online}`
      }
    }), "Active now");
  }
  return /*#__PURE__*/React.createElement("span", {
    style: badgeStyle({
      bg: 'rgba(168,144,112,.08)',
      fg: MR_PALETTE.muted,
      border: MR_PALETTE.border,
      size
    })
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: MR_PALETTE.muted,
      opacity: .5
    }
  }), lastSeen || 'Offline');
}
const badgeStyle = ({
  bg,
  fg,
  border,
  glow,
  bold,
  size
}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: size === 'xs' ? '3px 8px' : '4px 10px',
  borderRadius: 999,
  fontSize: size === 'xs' ? 10 : 11.5,
  fontWeight: bold ? 700 : 500,
  letterSpacing: bold ? '0.1em' : 0,
  textTransform: bold ? 'uppercase' : 'none',
  background: bg,
  color: fg,
  border: border ? `1px solid ${border}` : 'none',
  boxShadow: glow ? `0 0 16px ${MR_PALETTE.copper}55` : 'none',
  whiteSpace: 'nowrap'
});

// ── Verified badge (standalone) ──────────────────────────────
function VerifiedBadge({
  size = 'sm'
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: size === 'lg' ? '6px 12px' : '3px 9px',
      borderRadius: 999,
      background: 'rgba(196,131,42,.13)',
      color: MR_PALETTE.copper,
      border: `1px solid ${MR_PALETTE.copper}50`,
      fontSize: size === 'lg' ? 12 : 10.5,
      fontWeight: 600,
      letterSpacing: '0.04em'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: size === 'lg' ? 13 : 11,
    strokeWidth: 3
  }), "ID verified");
}

// ── "More" dropdown menu (three-dots) ────────────────────────
function MoreMenu({
  items,
  style: btnStyle
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: btnStyle,
    title: "More"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "more",
    size: 20
  })), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      zIndex: 61,
      minWidth: 178,
      padding: 6,
      borderRadius: 12,
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      boxShadow: '0 12px 32px rgba(0,0,0,.6)'
    }
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.label,
    onClick: () => {
      setOpen(false);
      it.onClick && it.onClick();
    },
    style: {
      display: 'flex',
      width: '100%',
      alignItems: 'center',
      gap: 8,
      padding: '9px 10px',
      borderRadius: 8,
      border: 0,
      cursor: 'pointer',
      background: 'transparent',
      textAlign: 'left',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 600,
      color: it.danger ? MR_PALETTE.danger : MR_PALETTE.text
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(196,131,42,.12)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, it.label)))));
}

// ── Distance pill ────────────────────────────────────────────
function DistancePill({
  mi,
  dark = true,
  size = 'md'
}) {
  const display = mi < 1 ? `${Math.round(mi * 1760)} yd` : `${mi.toFixed(1)} mi`;
  const xs = size === 'xs';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: xs ? 3 : 4,
      padding: xs ? '2px 6px' : '4px 10px',
      borderRadius: 999,
      background: dark ? 'rgba(13,10,6,.6)' : MR_PALETTE.elevated,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: `1px solid ${dark ? MR_PALETTE.border : 'transparent'}`,
      color: MR_PALETTE.text,
      fontSize: xs ? 9 : 11,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pin",
    size: xs ? 8 : 10,
    style: {
      color: MR_PALETTE.copper
    }
  }), display);
}

// ── Tribe / mood pill ────────────────────────────────────────
function TribePill({
  children,
  active = false,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: '7px 14px',
      borderRadius: 999,
      background: active ? MR_PALETTE.copper : 'rgba(196,131,42,.07)',
      color: active ? '#1A0E03' : MR_PALETTE.text,
      border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      cursor: 'pointer',
      boxShadow: active ? `0 0 14px ${MR_PALETTE.copper}44` : 'none',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit'
    }
  }, children);
}

// ── Pulse FAB ────────────────────────────────────────────────
function PulseFab({
  active = true,
  onClick,
  size = 64
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": "Pulse",
    style: {
      position: 'relative',
      width: size * 1.6,
      height: size * 1.6,
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0
    }
  }, active && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      ...pulseRing(size),
      opacity: .55,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...pulseRing(size),
      opacity: .38,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) .8s infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...pulseRing(size),
      opacity: .22,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) 1.6s infinite'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      zIndex: 2,
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      background: active ? `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper} 55%, ${MR_PALETTE.rust})` : MR_PALETTE.elevated,
      boxShadow: active ? `0 8px 28px rgba(0,0,0,.55), 0 0 32px ${MR_PALETTE.copper}99, inset 0 1px 0 rgba(255,220,170,.4)` : '0 6px 18px rgba(0,0,0,.4)',
      border: active ? `1px solid rgba(255,200,130,.25)` : `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/menrush-logo.png",
    alt: "",
    draggable: "false",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: active ? 'none' : 'grayscale(.7) brightness(.6)'
    }
  })));
}
const pulseRing = size => ({
  position: 'absolute',
  width: size,
  height: size,
  borderRadius: '50%',
  background: MR_PALETTE.copper,
  top: '50%',
  left: '50%',
  marginTop: -size / 2,
  marginLeft: -size / 2
});

// ── Buttons ──────────────────────────────────────────────────
function Button({
  children,
  variant = 'primary',
  onClick,
  full = false,
  size = 'md',
  disabled,
  style
}) {
  const sizes = {
    sm: {
      padding: '8px 16px',
      fontSize: 12
    },
    md: {
      padding: '12px 22px',
      fontSize: 14
    },
    lg: {
      padding: '14px 24px',
      fontSize: 14
    }
  };
  const variants = {
    primary: {
      background: MR_PALETTE.copper,
      color: '#1A0E03',
      boxShadow: `0 0 24px ${MR_PALETTE.copper}55`,
      border: 0
    },
    secondary: {
      background: 'transparent',
      color: MR_PALETTE.copper,
      border: `1px solid ${MR_PALETTE.copper}`
    },
    ghost: {
      background: 'rgba(196,131,42,.07)',
      color: MR_PALETTE.text,
      border: `1px solid ${MR_PALETTE.border}`
    },
    danger: {
      background: 'transparent',
      color: MR_PALETTE.danger,
      border: `1px solid ${MR_PALETTE.danger}80`
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    style: {
      ...sizes[size],
      ...variants[variant],
      width: full ? '100%' : 'auto',
      borderRadius: 999,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 600,
      fontFamily: 'inherit',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      opacity: disabled ? .5 : 1,
      transition: 'transform .15s ease',
      ...style
    }
  }, children);
}

// ── Message bubble ───────────────────────────────────────────
function MessageBubble({
  children,
  mine = false,
  time,
  seen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: mine ? 'flex-end' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '76%',
      padding: '10px 14px',
      background: mine ? `linear-gradient(135deg, ${MR_PALETTE.copper}, ${MR_PALETTE.rust})` : MR_PALETTE.elevated,
      color: mine ? '#1A0E03' : MR_PALETTE.text,
      border: mine ? 0 : `1px solid ${MR_PALETTE.border}`,
      borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      fontSize: 14.5,
      lineHeight: 1.45,
      fontWeight: mine ? 500 : 400,
      boxShadow: '0 4px 16px rgba(0,0,0,.45)'
    }
  }, children, time && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      marginTop: 4,
      opacity: mine ? .55 : .5,
      color: mine ? '#1A0E03' : MR_PALETTE.muted,
      fontFamily: 'ui-monospace, monospace'
    }
  }, time, seen ? ' · seen' : '')));
}

// ── Bottom nav (4 tabs) ──────────────────────────────────────
function BottomNav({
  active,
  onSelect,
  unread = 0,
  pulsing = false,
  onPulse
}) {
  const tabs = [{
    id: 'discover',
    label: 'Nearby',
    icon: 'compass'
  }, {
    id: 'matches',
    label: 'Matches',
    icon: 'flame'
  }, {
    id: 'pulse',
    label: 'Pulse',
    center: true
  }, {
    id: 'chat',
    label: 'Chat',
    icon: 'chat',
    badge: unread
  }, {
    id: 'profile',
    label: 'You',
    icon: 'user'
  }];
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 96,
      background: 'rgba(13,10,6,.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: 10,
      paddingBottom: 26,
      zIndex: 30
    }
  }, tabs.map(t => {
    if (t.center) {
      return /*#__PURE__*/React.createElement("button", {
        key: t.id,
        onClick: onPulse,
        "aria-label": "Pulse",
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          padding: 0,
          color: pulsing ? MR_PALETTE.copper : MR_PALETTE.faint,
          fontFamily: 'inherit',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.04em'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'relative',
          width: 46,
          height: 46,
          marginTop: -18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, pulsing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: MR_PALETTE.copper,
          opacity: .45,
          animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite'
        }
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: MR_PALETTE.copper,
          opacity: .25,
          animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) 1.2s infinite'
        }
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          position: 'relative',
          zIndex: 2,
          width: 46,
          height: 46,
          borderRadius: '50%',
          overflow: 'hidden',
          border: pulsing ? '1.5px solid rgba(255,200,130,.5)' : `1.5px solid ${MR_PALETTE.border}`,
          boxShadow: pulsing ? `0 4px 18px rgba(0,0,0,.5), 0 0 24px ${MR_PALETTE.copper}88` : '0 4px 14px rgba(0,0,0,.45)'
        }
      }, /*#__PURE__*/React.createElement("img", {
        src: "../../assets/menrush-logo.png",
        alt: "",
        draggable: "false",
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: pulsing ? 'none' : 'grayscale(.7) brightness(.6)'
        }
      }))), t.label);
    }
    const on = active === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => onSelect(t.id),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        padding: '4px 0',
        color: on ? MR_PALETTE.copper : MR_PALETTE.faint,
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        transform: on ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform .2s'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: t.icon,
      size: 22,
      strokeWidth: on ? 2.4 : 2
    }), t.badge > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -3,
        right: -5,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        background: MR_PALETTE.copper,
        color: '#1A0E03',
        fontSize: 9,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
        border: `1.5px solid ${MR_PALETTE.bg}`
      }
    }, t.badge > 9 ? '9+' : t.badge)), t.label);
  }));
}

// ── Top header ───────────────────────────────────────────────
function TopBar({
  title,
  subtitle,
  left,
  right
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 56,
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(13,10,6,.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${MR_PALETTE.border}`,
      position: 'relative',
      zIndex: 20,
      flexShrink: 0
    }
  }, left, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: 900,
      fontSize: 16,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: MR_PALETTE.muted,
      marginTop: 1
    }
  }, subtitle)), right);
}

// ── Modal scrim ──────────────────────────────────────────────
function Scrim({
  onClose,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,.7)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'nn-fade-in .25s cubic-bezier(.16,1,.3,1)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%'
    }
  }, children));
}
Object.assign(window, {
  MR_PALETTE,
  Icon,
  PulsingAvatar,
  StatusBadge,
  VerifiedBadge,
  DistancePill,
  TribePill,
  PulseFab,
  Button,
  MessageBubble,
  BottomNav,
  TopBar,
  Scrim,
  MoreMenu
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/ios-frame.jsx
try { (() => {
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports: IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/modals.jsx
try { (() => {
// MenRush — modals & sheets (unified PremiumGate, VideoCall, Boost, Incognito, Mood/Tribe sheet)
// Globals used: MR_PALETTE, Icon, Scrim, Button, PulsingAvatar, TribePill

// ────────────────────────────────────────────────────────────
// Unified PremiumGate — all paywalls share this pattern.
// One copper CTA, no scarcity timers, single layout.
// variant: 'likes' | 'boost' | 'incognito' | 'radius' | 'filters'
// ────────────────────────────────────────────────────────────
const PREMIUM_VARIANTS = {
  likes: {
    eyebrow: 'MENRUSH PREMIUM',
    title: '3 men liked you.',
    sub: 'See them. Open chat. Skip the queue.',
    perks: ['See who liked you', 'Expand radius to 30 miles', 'Message without matching', 'Boost — top of nearby for 30 minutes', 'Incognito · advanced filters'],
    cta: 'UNLOCK · £9.99/MO'
  },
  boost: {
    eyebrow: 'BOOST',
    title: 'Top of nearby. 30 minutes.',
    sub: 'Push your card to the top for every man in your radius.',
    perks: ['First in the grid for 30 minutes', 'Pulsing copper border on your card', 'More profile views while boosted', 'One-tap activate, no auto-renew'],
    cta: 'BOOST NOW · £4.99'
  },
  incognito: {
    eyebrow: 'INCOGNITO',
    title: 'Browse without being seen.',
    sub: 'See nearby men. They won\'t see you until you pulse.',
    perks: ['Hide from the discovery grid', 'No "active now" status leak', 'Still receive messages from matches', 'Toggle on or off any time'],
    cta: 'GO INVISIBLE · £4.99/MO',
    bundle: true
  },
  radius: {
    eyebrow: 'EXPANDED RADIUS',
    title: 'See further than 3 miles.',
    sub: 'Push your discovery range up to 30 miles — useful when you\'re travelling.',
    perks: ['Set radius up to 30 miles', 'Filter by city when away from home', 'Pin a custom location', 'Save up to 5 radius presets'],
    cta: 'EXPAND · £6.99/MO',
    bundle: true
  },
  filters: {
    eyebrow: 'ADVANCED FILTERS',
    title: 'Narrow it down.',
    sub: 'Filter the grid by tribe, ethnicity, body type, height, position, and what they\'re here for.',
    perks: ['Filter by 14 tribe tags', 'Ethnicity · body type · height · position', 'Mood · "here for" intent', 'Verified-only mode'],
    cta: 'UNLOCK FILTERS · £6.99/MO',
    bundle: true
  },
  media: {
    eyebrow: 'VOICE & VIDEO NOTES',
    title: 'Say it. Show it.',
    sub: 'Record voice and video notes straight from any chat. Everyone hears your voice notes — video notes are premium on both ends.',
    perks: ['Record & send voice notes', 'Record & send video notes', 'Watch every video note you receive', 'Unlimited 1:1 video calls'],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true
  },
  'video-note': {
    eyebrow: 'VIDEO NOTES',
    title: 'He sent you a video.',
    sub: 'Video notes are a premium feature. Upgrade to watch this one — and every one after it.',
    perks: ['Watch every video note you receive', 'Record & send your own', 'Unlimited 1:1 video calls'],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true
  },
  'video-call': {
    eyebrow: 'VIDEO CALLS',
    title: 'Face to face. Now.',
    sub: 'Video calls are premium-only. Upgrade to call any man in your chats.',
    perks: ['Unlimited 1:1 video calls', 'Voice & video notes', 'Message without matching'],
    cta: 'UNLOCK · £9.99/MO',
    bundle: true
  }
};
function PremiumGate({
  variant = 'likes',
  onClose
}) {
  const v = PREMIUM_VARIANTS[variant] || PREMIUM_VARIANTS.likes;
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose,
    style: {
      alignItems: 'center',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      borderRadius: 20,
      border: `1px solid ${MR_PALETTE.copper}50`,
      boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      margin: '0 auto',
      maxWidth: 400,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 5,
      width: 30,
      height: 30,
      borderRadius: '50%',
      background: 'rgba(13,10,6,.5)',
      border: `1px solid ${MR_PALETTE.border}`,
      color: MR_PALETTE.muted,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14,
    strokeWidth: 2.2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 24px 18px',
      textAlign: 'center',
      position: 'relative',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: 'url(../../assets/menrush-logo.png)',
      backgroundSize: '260px',
      backgroundPosition: 'center 30%',
      backgroundRepeat: 'no-repeat',
      opacity: .16,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.22em',
      color: MR_PALETTE.copper
    }
  }, v.eyebrow), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '12px 0 4px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text,
      textWrap: 'balance'
    }
  }, v.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: MR_PALETTE.muted,
      margin: 0,
      lineHeight: 1.45
    }
  }, v.sub))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 24px 22px'
    }
  }, v.perks.map(p => /*#__PURE__*/React.createElement("div", {
    key: p,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      fontSize: 14,
      color: MR_PALETTE.text
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      flexShrink: 0
    }
  }), p)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onClose
  }, v.cta)), v.bundle && /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11.5,
      color: MR_PALETTE.muted,
      marginTop: 14,
      lineHeight: 1.5,
      padding: '10px 12px',
      background: 'rgba(196,131,42,.06)',
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 10
    }
  }, "Get this plus 4 more in ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: MR_PALETTE.copper,
      fontWeight: 700
    }
  }, "MenRush Premium"), " for \xA39.99/mo."), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: MR_PALETTE.faint,
      marginTop: 12
    }
  }, "Cancel anytime."))));
}

// ────────────────────────────────────────────────────────────
// Boost confirmation — different from PremiumGate (this fires AFTER they pay)
// ────────────────────────────────────────────────────────────
function BoostConfirmModal({
  onClose
}) {
  const [remaining, setRemaining] = React.useState('29:48');
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose,
    style: {
      alignItems: 'center',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      borderRadius: 20,
      maxWidth: 360,
      margin: '0 auto',
      border: `1px solid ${MR_PALETTE.copper}50`,
      boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      textAlign: 'center',
      padding: '28px 24px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 88,
      height: 88,
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: pulseRing88(0)
  }), /*#__PURE__*/React.createElement("span", {
    style: pulseRing88(1)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 22,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 30px ${MR_PALETTE.copper}aa, inset 0 1px 0 rgba(255,220,170,.4)`,
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pulse",
    size: 22,
    strokeWidth: 2.4,
    style: {
      color: '#1A0E03'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.22em',
      color: MR_PALETTE.copper
    }
  }, "BOOSTED"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '8px 0 6px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, "Boost active."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: MR_PALETTE.muted,
      margin: '0 0 18px',
      lineHeight: 1.5
    }
  }, "Your profile jumps ahead of non-boosted men in your radius for the next 30 minutes."), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: MR_PALETTE.muted
    }
  }, "REMAINING"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'ui-monospace, monospace',
      fontSize: 28,
      fontWeight: 700,
      color: MR_PALETTE.copper,
      marginTop: 2
    }
  }, remaining)), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    full: true,
    onClick: onClose
  }, "Got it")));
}
const pulseRing88 = i => ({
  position: 'absolute',
  width: 44,
  height: 44,
  top: 22,
  left: 22,
  borderRadius: '50%',
  background: MR_PALETTE.copper,
  opacity: i === 0 ? .5 : .3,
  animation: `nn-radar 2.4s cubic-bezier(.16,1,.3,1) ${i * 0.8}s infinite`
});

// ────────────────────────────────────────────────────────────
// Video call modal
// Full-screen-ish (inside device) — incoming call + active call patterns
// ────────────────────────────────────────────────────────────
function VideoCallModal({
  user,
  state = 'incoming',
  onClose,
  onAnswer,
  onHangup
}) {
  if (state === 'incoming') {
    return /*#__PURE__*/React.createElement(Scrim, {
      onClose: onClose,
      style: {
        alignItems: 'stretch',
        padding: 0,
        background: 'rgba(0,0,0,.92)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '60px 24px 110px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.22em',
        color: MR_PALETTE.copper,
        marginBottom: 14
      }
    }, "\u25CF INCOMING VIDEO"), /*#__PURE__*/React.createElement(PulsingAvatar, {
      name: user.name,
      pulsing: true,
      verified: user.verified,
      size: 120
    }), /*#__PURE__*/React.createElement("h2", {
      style: {
        marginTop: 22,
        fontFamily: 'Inter, sans-serif',
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: MR_PALETTE.text
      }
    }, user.name), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        color: MR_PALETTE.muted,
        marginTop: 6
      }
    }, user.distMi < 1 ? `${Math.round(user.distMi * 1760)} yd away` : `${user.distMi.toFixed(1)} mi away`)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 40,
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(CallButton, {
      kind: "hangup",
      onClick: onHangup
    }), /*#__PURE__*/React.createElement(CallButton, {
      kind: "answer",
      onClick: onAnswer
    }))));
  }
  // active state
  const [facing, setFacing] = React.useState('front');
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose,
    style: {
      alignItems: 'stretch',
      padding: 0,
      background: '#000'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: '100%',
      overflow: 'hidden',
      background: `linear-gradient(160deg, #2A1C0A 0%, #0D0A06 80%)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(196,131,42,.18)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 180,
    strokeWidth: 1.2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 16,
      right: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 12px',
      borderRadius: 999,
      background: 'rgba(13,10,6,.6)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${MR_PALETTE.border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#B0432E',
      boxShadow: '0 0 8px #B0432E'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: MR_PALETTE.text,
      fontFamily: 'ui-monospace, monospace'
    }
  }, "02:14")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: MR_PALETTE.text
    }
  }, user.name)), /*#__PURE__*/React.createElement(DraggablePiP, {
    facing: facing
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 110,
      left: 0,
      right: 0,
      display: 'flex',
      gap: 16,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(CallButton, {
    kind: "mic"
  }), /*#__PURE__*/React.createElement(CallButton, {
    kind: "camera"
  }), /*#__PURE__*/React.createElement(CallButton, {
    kind: "hangup",
    onClick: onHangup
  }), /*#__PURE__*/React.createElement(CallButton, {
    kind: "flip",
    onClick: () => setFacing(f => f === 'front' ? 'back' : 'front')
  }))));
}

// My-video PiP — draggable anywhere, resizable from the copper corner grip
function DraggablePiP({
  facing = 'front'
}) {
  const RATIO = 110 / 80,
    MINW = 60,
    MAXW = 200;
  const [w, setW] = React.useState(80);
  const [pos, setPos] = React.useState(null); // null = default top-right
  const ref = React.useRef(null);
  const startDrag = e => {
    if (e.target.closest('[data-grip]')) return;
    e.preventDefault();
    const el = ref.current,
      parent = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left,
      oy = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const rw = el.getBoundingClientRect();
      setPos({
        x: Math.max(8, Math.min(ev.clientX - parent.left - ox, parent.width - rw.width - 8)),
        y: Math.max(50, Math.min(ev.clientY - parent.top - oy, parent.height - rw.height - 8))
      });
    };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };
  const startResize = e => {
    e.preventDefault();
    e.stopPropagation();
    const grip = e.currentTarget,
      startW = w,
      sx = e.clientX;
    grip.setPointerCapture(e.pointerId);
    const mv = ev => setW(Math.max(MINW, Math.min(MAXW, startW + (ev.clientX - sx))));
    const up = () => {
      grip.removeEventListener('pointermove', mv);
      grip.removeEventListener('pointerup', up);
    };
    grip.addEventListener('pointermove', mv);
    grip.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    onPointerDown: startDrag,
    style: {
      position: 'absolute',
      ...(pos ? {
        left: pos.x,
        top: pos.y
      } : {
        top: 110,
        right: 16
      }),
      width: w,
      height: Math.round(w * RATIO),
      borderRadius: 12,
      background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
      border: `1px solid ${MR_PALETTE.copper}55`,
      boxShadow: '0 8px 24px rgba(0,0,0,.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(196,131,42,.3)',
      cursor: 'grab',
      touchAction: 'none',
      userSelect: 'none',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: Math.round(w / 2),
    strokeWidth: 1.4
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 6,
      left: 8,
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: '0.16em',
      color: MR_PALETTE.muted
    }
  }, facing.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    "data-grip": true,
    onPointerDown: startResize,
    style: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 18,
      height: 18,
      borderRadius: '10px 0 11px 0',
      background: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'nwse-resize'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#1A0E03",
    strokeWidth: "3",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v6h-6M21 21L13 13"
  }))));
}
function CallButton({
  kind,
  onClick
}) {
  const cfg = {
    answer: {
      bg: MR_PALETTE.online,
      color: '#0D1A06',
      icon: 'video',
      size: 72
    },
    hangup: {
      bg: MR_PALETTE.danger,
      color: '#fff',
      icon: 'x',
      size: 72
    },
    mic: {
      bg: 'rgba(255,255,255,.12)',
      color: '#fff',
      icon: 'mic',
      size: 56
    },
    camera: {
      bg: 'rgba(255,255,255,.12)',
      color: '#fff',
      icon: 'video',
      size: 56
    },
    flip: {
      bg: 'rgba(255,255,255,.12)',
      color: '#fff',
      icon: 'flip',
      size: 56
    }
  }[kind];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": kind,
    style: {
      width: cfg.size,
      height: cfg.size,
      borderRadius: '50%',
      background: cfg.bg,
      color: cfg.color,
      border: 0,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(0,0,0,.5)'
    }
  }, /*#__PURE__*/React.createElement(ExtraIcon, {
    name: cfg.icon,
    size: cfg.size * 0.42
  }));
}
// extra icons for video controls
function ExtraIcon({
  name,
  size
}) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
  if (name === 'video') return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "6",
    width: "14",
    height: "12",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 10l4-3v10l-4-3z",
    fill: "currentColor"
  }));
  if (name === 'mic') return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "3",
    width: "6",
    height: "12",
    rx: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 12a7 7 0 0 0 14 0M12 19v3M8 22h8"
  }));
  if (name === 'flip') return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
    points: "17 1 21 5 17 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 11V9a4 4 0 0 1 4-4h14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 23 3 19 7 15"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 13v2a4 4 0 0 1-4 4H3"
  }));
  if (name === 'x') return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }));
  return null;
}

// ────────────────────────────────────────────────────────────
// Mood / Tribe picker — full bottom sheet
// ────────────────────────────────────────────────────────────
const TRIBES = ['Bear', 'Cub', 'Daddy', 'Jock', 'Leather', 'Otter', 'Twink', 'Wolf', 'Geek', 'Punk', 'Sub', 'Top'];
const MOODS = ['NSA', 'Hookup', 'Date', 'Drinks', 'Chat', 'Workout', 'Long-term'];
const ETHNICITIES = ['Asian', 'Black', 'Latino', 'Middle Eastern', 'Mixed', 'Native American', 'South Asian', 'White', 'Other'];
function MoodTribeSheet({
  initialTribes = [],
  initialMood = null,
  initialEthnicities = [],
  onClose,
  onSave
}) {
  const [tribes, setTribes] = React.useState(initialTribes);
  const [mood, setMood] = React.useState(initialMood);
  const [eths, setEths] = React.useState(initialEthnicities);
  const toggle = t => setTribes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleEth = e => setEths(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTop: `1px solid ${MR_PALETTE.border}`,
      boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      paddingBottom: 30,
      maxHeight: '92%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '10px 0 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: MR_PALETTE.border
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px 8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'Inter, sans-serif',
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, "You"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'transparent',
      border: 0,
      color: MR_PALETTE.muted,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13
    }
  }, "Cancel")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.muted
    }
  }, "HERE FOR"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.16em',
      color: MR_PALETTE.faint
    }
  }, "PICK ONE")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, MOODS.map(m => /*#__PURE__*/React.createElement(MoodRadio, {
    key: m,
    label: m,
    active: mood === m,
    onClick: () => setMood(m)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.muted
    }
  }, "TRIBES"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '3px 9px',
      borderRadius: 999,
      background: tribes.length === 4 ? MR_PALETTE.copper : `${MR_PALETTE.copper}1f`,
      color: tribes.length === 4 ? '#1A0E03' : MR_PALETTE.copper,
      border: tribes.length === 4 ? 0 : `1px solid ${MR_PALETTE.copper}55`
    }
  }, tribes.length, " of 4 selected")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, TRIBES.map(t => {
    const on = tribes.includes(t);
    const disabled = !on && tribes.length >= 4;
    return /*#__PURE__*/React.createElement(TribeChip, {
      key: t,
      label: t,
      active: on,
      disabled: disabled,
      onClick: () => !disabled && toggle(t)
    });
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.muted
    }
  }, "ETHNICITY"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.16em',
      color: MR_PALETTE.faint
    }
  }, "OPTIONAL")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, ETHNICITIES.map(e => /*#__PURE__*/React.createElement(TribeChip, {
    key: e,
    label: e,
    active: eths.includes(e),
    onClick: () => toggleEth(e)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 20px 0'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: () => onSave && onSave({
      tribes,
      mood,
      ethnicities: eths
    })
  }, "Save"))));
}

// ── Radio row (Mood — single-select) ─────────────────────────
function MoodRadio({
  label,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    role: "radio",
    "aria-checked": active,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      padding: '12px 14px',
      borderRadius: 12,
      background: active ? `${MR_PALETTE.copper}18` : 'transparent',
      border: `1px solid ${active ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'inherit',
      transition: 'background .15s, border-color .15s',
      boxShadow: active ? `inset 0 0 24px ${MR_PALETTE.copper}10` : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: '50%',
      flexShrink: 0,
      border: `2px solid ${active ? MR_PALETTE.copper : MR_PALETTE.faint}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      transition: 'border-color .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: active ? MR_PALETTE.copper : 'transparent',
      boxShadow: active ? `0 0 8px ${MR_PALETTE.copper}` : 'none',
      transform: active ? 'scale(1)' : 'scale(0)',
      transition: 'transform .2s cubic-bezier(.16,1,.3,1)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: active ? 700 : 500,
      color: active ? MR_PALETTE.text : MR_PALETTE.muted
    }
  }, label));
}

// ── Multi-select chip (Tribes — pick up to 4) ────────────────
function TribeChip({
  label,
  active,
  disabled,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    role: "checkbox",
    "aria-checked": active,
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: active ? '7px 12px 7px 9px' : '7px 14px',
      borderRadius: 999,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? MR_PALETTE.copper : 'rgba(196,131,42,.06)',
      color: active ? '#1A0E03' : disabled ? MR_PALETTE.faint : MR_PALETTE.text,
      border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      boxShadow: active ? `0 0 14px ${MR_PALETTE.copper}44` : 'none',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
      opacity: disabled ? 0.5 : 1,
      transition: 'background .15s, padding .15s'
    }
  }, active && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: '#1A0E03',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: MR_PALETTE.copper
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 9,
    strokeWidth: 3.5
  })), label);
}

// ────────────────────────────────────────────────────────────
// Incognito toggle — full screen (settings sub-page)
// ────────────────────────────────────────────────────────────
function IncognitoScreen({
  active: initial = false,
  onBack
}) {
  const [active, setActive] = React.useState(initial);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: MR_PALETTE.bg,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    left: /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: iconBtn()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 22,
      strokeWidth: 2.2
    })),
    title: "INCOGNITO"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '30px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 96,
      height: 96,
      borderRadius: '50%',
      background: active ? `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})` : MR_PALETTE.elevated,
      border: `1px solid ${active ? 'transparent' : MR_PALETTE.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: active ? `0 0 40px ${MR_PALETTE.copper}77` : 'none',
      color: active ? '#1A0E03' : MR_PALETTE.muted
    }
  }, /*#__PURE__*/React.createElement(IncognitoGlyph, {
    size: 44
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 6px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, active ? 'Invisible' : 'Visible'), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: MR_PALETTE.muted,
      margin: 0,
      lineHeight: 1.5
    }
  }, active ? "You're hidden from the discovery grid. They won't see you until you pulse." : "Other men in your radius can see you and message you.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      background: MR_PALETTE.card,
      border: `1px solid ${active ? MR_PALETTE.copper + '55' : MR_PALETTE.border}`,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: active ? `0 0 24px ${MR_PALETTE.copper}22` : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: MR_PALETTE.text
    }
  }, "Incognito mode"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: MR_PALETTE.muted,
      marginTop: 2
    }
  }, "Premium feature")), /*#__PURE__*/React.createElement(Toggle, {
    active: active,
    onChange: () => setActive(a => !a)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [['Hidden from the grid', 'Your card doesn\'t appear in anyone\'s nearby list.'], ['No "active now"', 'Status flips to "Last seen 1d" for everyone.'], ['You still receive messages', 'Matches and existing chats keep working.'], ['Toggle off any time', 'You re-appear immediately. No cooldown.']].map(([t, d]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: MR_PALETTE.text
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: MR_PALETTE.muted,
      marginTop: 1
    }
  }, d)))))));
}
function Toggle({
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onChange,
    "aria-pressed": active,
    style: {
      width: 52,
      height: 30,
      borderRadius: 999,
      background: active ? MR_PALETTE.copper : MR_PALETTE.border,
      border: 0,
      cursor: 'pointer',
      position: 'relative',
      transition: 'background .2s',
      boxShadow: active ? `0 0 16px ${MR_PALETTE.copper}88, inset 0 1px 0 rgba(255,220,170,.3)` : 'inset 0 1px 0 rgba(0,0,0,.4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: active ? 25 : 3,
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: active ? '#1A0E03' : MR_PALETTE.muted,
      transition: 'left .2s cubic-bezier(.16,1,.3,1)',
      boxShadow: '0 2px 6px rgba(0,0,0,.4)'
    }
  }));
}
function IncognitoGlyph({
  size = 24
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 12s4-8 11-8 11 8 11 8",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "3",
    x2: "21",
    y2: "21"
  }));
}

// Local helper duplicated for self-containment (matches screens.jsx)
const iconBtn = highlight => ({
  width: 38,
  height: 38,
  borderRadius: 999,
  border: 0,
  cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});
Object.assign(window, {
  PremiumGate,
  PREMIUM_VARIANTS,
  BoostConfirmModal,
  VideoCallModal,
  MoodTribeSheet,
  MoodRadio,
  TribeChip,
  IncognitoScreen,
  Toggle,
  IncognitoGlyph,
  TRIBES,
  MOODS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/modals.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/rooms.jsx
try { (() => {
// MenRush — Rooms (group chat).
// RoomsListScreen — directory of nearby rooms, joinable.
// RoomChatScreen — multi-participant chat with avatar gutter.
// Globals: MR_PALETTE, Icon, Button, PulsingAvatar, MessageBubble, TopBar, TribePill, BottomNav

const MR_ROOMS = [{
  id: 'r1',
  name: 'East Village Tonight',
  tribe: 'Open',
  distMi: 0.8,
  active: 24,
  pulsing: true,
  desc: 'Anyone out tonight in EV?',
  lastFrom: 'Marcus',
  lastMsg: 'Stonewall back patio after 11',
  lastTime: '2m'
}, {
  id: 'r2',
  name: 'Leather Pride NYC',
  tribe: 'Leather',
  distMi: 1.6,
  active: 18,
  pulsing: true,
  desc: 'Pre-game and meetups for fetish nights.',
  lastFrom: 'Reyes',
  lastMsg: 'EAGLE is packed.',
  lastTime: '6m'
}, {
  id: 'r3',
  name: 'Bears @ Brooklyn',
  tribe: 'Bear',
  distMi: 3.4,
  active: 12,
  pulsing: false,
  desc: 'Brunch, brews, and friends.',
  lastFrom: 'Theo',
  lastMsg: 'New spot on Bedford?',
  lastTime: '14m'
}, {
  id: 'r4',
  name: 'Daddy / Boy',
  tribe: 'Daddy',
  distMi: 2.1,
  active: 9,
  pulsing: false,
  desc: 'Mentorship and meets. 30+ only.',
  lastFrom: 'Joaquin',
  lastMsg: 'On it.',
  lastTime: '38m'
}, {
  id: 'r5',
  name: 'Jock Talk',
  tribe: 'Jock',
  distMi: 0.4,
  active: 31,
  pulsing: true,
  desc: 'Gym, workout buddies, post-lift hangs.',
  lastFrom: 'Dane',
  lastMsg: 'PR today. Anyone lifting tomorrow?',
  lastTime: '1h'
}, {
  id: 'r6',
  name: 'New in town',
  tribe: 'Open',
  distMi: 4.9,
  active: 7,
  pulsing: false,
  desc: 'Just moved? Say hi.',
  lastFrom: 'Kavi',
  lastMsg: 'British, here a week.',
  lastTime: '2h'
}];

// ── Rooms list ─────────────────────────────────────────────
const ROOM_CATS = ['All', 'Nearby', 'Open', 'Leather', 'Bear', 'Daddy', 'Jock', 'Tonight'];
function RoomsListScreen({
  onOpenRoom,
  onCreate
}) {
  const [rooms, setRooms] = React.useState(MR_ROOMS);
  const [cat, setCat] = React.useState('Nearby');
  const [createOpen, setCreateOpen] = React.useState(false);
  let shown = rooms;
  if (cat === 'Nearby') shown = [...rooms].sort((a, b) => a.distMi - b.distMi);else if (cat === 'Tonight') shown = rooms.filter(r => r.pulsing);else if (cat !== 'All') shown = rooms.filter(r => r.tribe === cat);
  const openCreate = () => setCreateOpen(true);
  return /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      flex: 1,
      paddingBottom: 110,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "ROOMS",
    subtitle: `${rooms.reduce((a, r) => a + r.active, 0)} men active across ${rooms.length} rooms`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: openCreate,
      style: roomsIconBtn(true),
      title: "New room"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "more",
      size: 20,
      strokeWidth: 2
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '12px 16px 4px',
      overflowX: 'auto'
    }
  }, ROOM_CATS.map(c => /*#__PURE__*/React.createElement(TribePill, {
    key: c,
    active: c === cat,
    onClick: () => setCat(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 12px'
    }
  }, shown.map(r => /*#__PURE__*/React.createElement(RoomRow, {
    key: r.id,
    room: r,
    onOpen: () => onOpenRoom(r)
  })), shown.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 16px',
      textAlign: 'center',
      fontSize: 13,
      color: MR_PALETTE.muted
    }
  }, "No rooms here yet. Start one.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: openCreate,
    style: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: 14,
      background: 'transparent',
      border: `1px dashed ${MR_PALETTE.copper}55`,
      color: MR_PALETTE.copper,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "+ Start a room")), createOpen && /*#__PURE__*/React.createElement(CreateRoomSheet, {
    onClose: () => setCreateOpen(false),
    onCreate: room => {
      setRooms(rs => [room, ...rs]);
      setCreateOpen(false);
      setCat('All');
    }
  }));
}
function CreateRoomSheet({
  onClose,
  onCreate
}) {
  const [name, setName] = React.useState('');
  const [tribe, setTribe] = React.useState('Open');
  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: 'new-' + Date.now(),
      name: name.trim(),
      tribe,
      distMi: 0,
      active: 1,
      pulsing: true,
      desc: '',
      lastFrom: 'You',
      lastMsg: 'Room created.',
      lastTime: 'now'
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      background: 'rgba(0,0,0,.6)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: MR_PALETTE.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTop: `1px solid ${MR_PALETTE.border}`,
      boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      padding: '10px 20px 40px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '0 0 6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 4,
      borderRadius: 2,
      background: MR_PALETTE.border
    }
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '8px 0 14px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, "Start a room"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    autoFocus: true,
    onKeyDown: e => e.key === 'Enter' && create(),
    placeholder: "Room name \u2014 direct, no fluff",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '13px 16px',
      borderRadius: 12,
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      color: MR_PALETTE.text,
      fontSize: 14,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.muted,
      margin: '16px 0 8px'
    }
  }, "TRIBE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, ['Open', 'Leather', 'Bear', 'Daddy', 'Jock', 'Otter', 'Twink'].map(t => /*#__PURE__*/React.createElement(TribePill, {
    key: t,
    active: t === tribe,
    onClick: () => setTribe(t)
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    disabled: !name.trim(),
    onClick: create
  }, "CREATE ROOM"))));
}
function RoomRow({
  room,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onOpen,
    style: {
      width: '100%',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      padding: '12px 14px',
      borderRadius: 14,
      marginBottom: 8,
      background: MR_PALETTE.card,
      border: `1px solid ${MR_PALETTE.border}`,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'inherit',
      color: 'inherit',
      boxShadow: 'inset 0 1px 0 rgba(255,200,130,.04)'
    }
  }, /*#__PURE__*/React.createElement(RoomGlyph, {
    tribe: room.tribe,
    pulsing: room.pulsing
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: MR_PALETTE.text
    }
  }, room.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: MR_PALETTE.faint,
      fontFamily: 'ui-monospace, monospace'
    }
  }, "\xB7 ", room.distMi < 1 ? `${Math.round(room.distMi * 1760)} yd` : `${room.distMi.toFixed(1)} mi`)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: MR_PALETTE.muted,
      marginTop: 2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: MR_PALETTE.text,
      fontWeight: 600
    }
  }, room.lastFrom), ": ", room.lastMsg)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: MR_PALETTE.faint,
      fontFamily: 'ui-monospace, monospace'
    }
  }, room.lastTime), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 999,
      background: room.pulsing ? `${MR_PALETTE.copper}1f` : 'rgba(168,144,112,.06)',
      color: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted,
      border: room.pulsing ? `1px solid ${MR_PALETTE.copper}33` : `1px solid ${MR_PALETTE.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted
    }
  }), room.active)));
}
function RoomGlyph({
  tribe,
  pulsing
}) {
  const letter = tribe === 'Open' ? '●' : tribe[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 50,
      height: 50,
      flexShrink: 0
    }
  }, pulsing && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 12,
      background: MR_PALETTE.copper,
      opacity: .35,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite',
      transformOrigin: 'center'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50,
      height: 50,
      borderRadius: 12,
      background: `linear-gradient(160deg, ${MR_PALETTE.elevated}, ${MR_PALETTE.card})`,
      border: `1.5px solid ${MR_PALETTE.copper}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: MR_PALETTE.copper,
      fontWeight: 900,
      fontSize: 18,
      letterSpacing: '0.04em',
      boxShadow: `0 0 0 3px ${MR_PALETTE.copper}1a, 0 4px 12px rgba(0,0,0,.4)`,
      position: 'relative',
      zIndex: 2
    }
  }, letter));
}

// ── Room chat (group thread) ────────────────────────────────
const MR_ROOM_MESSAGES = [{
  from: 'Marcus',
  initial: 'M',
  mine: false,
  text: 'who\'s out tonight in EV?',
  time: '10:14 PM',
  verified: true
}, {
  from: 'Reyes',
  initial: 'R',
  mine: false,
  text: 'EAGLE\'s mine. Doors at 11.',
  time: '10:15 PM',
  verified: true
}, {
  from: 'Dane',
  initial: 'D',
  mine: false,
  text: 'cover?',
  time: '10:15 PM'
}, {
  from: 'Reyes',
  initial: 'R',
  mine: false,
  text: '$15 before midnight.',
  time: '10:16 PM',
  verified: true
}, {
  from: 'You',
  initial: 'Y',
  mine: true,
  text: 'i\'ll be there. Stonewall back patio first.',
  time: '10:18 PM'
}, {
  from: 'Marcus',
  initial: 'M',
  mine: false,
  text: 'meet you there. cigar bar after?',
  time: '10:18 PM',
  verified: true
}];
function RoomChatScreen({
  room,
  onBack,
  onOpenMember
}) {
  const [messages, setMessages] = React.useState(MR_ROOM_MESSAGES);
  const [draft, setDraft] = React.useState('');
  const [joined, setJoined] = React.useState(true);
  const ref = React.useRef(null);
  const send = () => {
    if (!draft.trim()) return;
    setMessages(m => [...m, {
      from: 'You',
      initial: 'Y',
      mine: true,
      text: draft.trim(),
      time: 'now'
    }]);
    setDraft('');
    setTimeout(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, 50);
  };

  // Decide when to show the avatar (first msg from sender in a streak)
  const withMeta = messages.map((m, i, arr) => ({
    ...m,
    showName: !m.mine && (i === 0 || arr[i - 1].from !== m.from)
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: MR_PALETTE.bg,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    left: /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: roomsIconBtn()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 22,
      strokeWidth: 2.2
    })),
    right: /*#__PURE__*/React.createElement(MoreMenu, {
      style: roomsIconBtn(),
      items: [{
        label: 'Room info'
      }, {
        label: 'Mute room'
      }, {
        label: 'Report room',
        danger: true
      }, {
        label: 'Leave room',
        danger: true
      }]
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: MR_PALETTE.card,
      borderBottom: `1px solid ${MR_PALETTE.border}`
    }
  }, /*#__PURE__*/React.createElement(RoomGlyph, {
    tribe: room.tribe,
    pulsing: room.pulsing
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: MR_PALETTE.text
    }
  }, room.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted,
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: room.pulsing ? MR_PALETTE.copper : MR_PALETTE.muted,
      boxShadow: room.pulsing ? `0 0 8px ${MR_PALETTE.copper}` : 'none'
    }
  }), room.active, " active"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.faint
    }
  }, " \xB7 ", room.tribe, " \xB7 ", room.distMi < 1 ? `${Math.round(room.distMi * 1760)} yd` : `${room.distMi.toFixed(1)} mi`))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setJoined(j => !j),
    style: {
      padding: '6px 12px',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      borderRadius: 999,
      fontFamily: 'inherit',
      background: joined ? 'transparent' : MR_PALETTE.copper,
      color: joined ? MR_PALETTE.copper : '#1A0E03',
      border: `1px solid ${MR_PALETTE.copper}`,
      cursor: 'pointer'
    }
  }, joined ? 'Joined' : 'Join')), /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: "scroll",
    style: {
      flex: 1,
      padding: '14px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      margin: '6px 0 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.faint
    }
  }, "TODAY \xB7 10:14 PM")), withMeta.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, m.showName && /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenMember && onOpenMember(m),
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: MR_PALETTE.muted,
      paddingLeft: 44,
      marginBottom: 2,
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      alignSelf: 'flex-start',
      fontFamily: 'inherit'
    }
  }, m.from, m.verified && ' ✓'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      justifyContent: m.mine ? 'flex-end' : 'flex-start'
    }
  }, !m.mine && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      flexShrink: 0
    }
  }, m.showName ? /*#__PURE__*/React.createElement(PulsingAvatar, {
    name: m.from,
    size: 32,
    verified: m.verified
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '72%',
      padding: '8px 13px',
      background: m.mine ? `linear-gradient(135deg, ${MR_PALETTE.copper}, ${MR_PALETTE.rust})` : MR_PALETTE.elevated,
      color: m.mine ? '#1A0E03' : MR_PALETTE.text,
      border: m.mine ? 0 : `1px solid ${MR_PALETTE.border}`,
      borderRadius: m.mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      fontSize: 14,
      lineHeight: 1.4,
      fontWeight: m.mine ? 500 : 400
    }
  }, m.text, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      marginTop: 3,
      opacity: .55,
      fontFamily: 'ui-monospace, monospace',
      color: m.mine ? '#1A0E03' : MR_PALETTE.muted
    }
  }, m.time)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px 38px',
      background: 'rgba(13,10,6,.92)',
      borderTop: `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 999,
      padding: '6px 6px 6px 16px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => e.key === 'Enter' && send(),
    placeholder: "Say something to the room\u2026",
    style: {
      flex: 1,
      background: 'transparent',
      border: 0,
      outline: 'none',
      color: MR_PALETTE.text,
      fontSize: 14,
      fontFamily: 'inherit',
      padding: '6px 0'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: send,
    style: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: MR_PALETTE.copper,
      color: '#1A0E03',
      boxShadow: `0 0 16px ${MR_PALETTE.copper}66`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 16
  })))));
}
const roomsIconBtn = highlight => ({
  width: 38,
  height: 38,
  borderRadius: 999,
  border: 0,
  cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});
Object.assign(window, {
  RoomsListScreen,
  RoomChatScreen,
  RoomRow,
  RoomGlyph,
  CreateRoomSheet,
  MR_ROOMS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/rooms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/screens.jsx
try { (() => {
// MenRush — screens (Discover, ProfileDrawer, ChatThread, PremiumGate).
// Uses globals: PulsingAvatar, StatusBadge, VerifiedBadge, DistancePill, TribePill,
// PulseFab, Button, MessageBubble, BottomNav, TopBar, Scrim, Icon, MR_PALETTE

const MR_USERS = [{
  id: 'm',
  name: 'Marcus',
  age: 32,
  distMi: 0.4,
  online: true,
  verified: true,
  pulsing: true,
  bio: 'Cigar bar regular. East Village. Top.',
  tribes: ['Bear', 'Leather'],
  mood: 'NSA',
  lastMsg: 'Saw your pulse. Where are you?'
}, {
  id: 'd',
  name: 'Dane',
  age: 28,
  distMi: 2.1,
  online: true,
  verified: false,
  pulsing: false,
  bio: 'New in town. Looking for tonight.',
  tribes: ['Jock', 'Otter'],
  mood: 'Drinks'
}, {
  id: 'r',
  name: 'Reyes',
  age: 41,
  distMi: 0.8,
  online: true,
  verified: true,
  pulsing: true,
  bio: 'Daddy. Industrial. No timewasters.',
  tribes: ['Daddy', 'Leather'],
  mood: 'Hookup'
}, {
  id: 'j',
  name: 'Joaquin',
  age: 36,
  distMi: 1.6,
  online: false,
  verified: true,
  pulsing: false,
  bio: 'Mexican-Italian. Tattoos and tequila.',
  lastSeen: '12m',
  tribes: ['Bear'],
  mood: 'Date'
}, {
  id: 't',
  name: 'Theo',
  age: 26,
  distMi: 3.4,
  online: false,
  verified: false,
  pulsing: false,
  bio: 'Yoga + black coffee. Bottom.',
  lastSeen: '1h',
  tribes: ['Twink'],
  mood: 'Chat'
}, {
  id: 'k',
  name: 'Kavi',
  age: 38,
  distMi: 4.9,
  online: true,
  verified: true,
  pulsing: false,
  bio: 'British. In NYC for the week.',
  tribes: ['Otter'],
  mood: 'Drinks'
}];

// ── Discover (the home screen) ───────────────────────────────
function DiscoverScreen({
  onOpenUser,
  onOpenPremium,
  onOpenFilters,
  radius,
  setRadius,
  pulsing,
  setPulsing
}) {
  const [sort, setSort] = React.useState('Distance');
  const sorted = [...MR_USERS].sort((a, b) => sort === 'Distance' ? a.distMi - b.distMi : sort === 'Active' ? b.pulsing - a.pulsing || b.online - a.online || a.distMi - b.distMi : a.age - b.age);
  const visible = sorted.filter(u => u.distMi <= radius);
  const onlineCount = visible.filter(u => u.online).length;
  const pulseCount = visible.filter(u => u.pulsing).length;
  const [mapOpen, setMapOpen] = React.useState(() => localStorage.getItem('mr-map-open') !== '0');
  const toggleMap = () => setMapOpen(o => {
    localStorage.setItem('mr-map-open', o ? '0' : '1');
    return !o;
  });
  const mapToggleBtn = (dir, pos) => /*#__PURE__*/React.createElement("button", {
    onClick: toggleMap,
    title: dir === 'up' ? 'Hide map' : 'Show map',
    style: {
      position: 'absolute',
      ...pos,
      zIndex: 6,
      width: 26,
      height: 26,
      borderRadius: 999,
      border: `1px solid ${MR_PALETTE.border}`,
      background: 'rgba(13,10,6,.7)',
      backdropFilter: 'blur(10px)',
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, dir === 'up' ? /*#__PURE__*/React.createElement("polyline", {
    points: "18 15 12 9 6 15"
  }) : /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      flex: 1,
      paddingBottom: 96,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "MENRUSH",
    subtitle: `${onlineCount} active · ${pulseCount} pulsing in ${radius} mi`,
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onOpenPremium,
      style: iconBtn(true),
      title: "Premium"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkle",
      size: 18,
      strokeWidth: 2.2
    })), /*#__PURE__*/React.createElement("button", {
      onClick: onOpenFilters,
      style: iconBtn(),
      title: "Filters"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 18,
      strokeWidth: 2
    })))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: mapOpen ? 200 : 0,
      overflow: 'hidden',
      transition: 'height .35s cubic-bezier(.16,1,.3,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 200,
      overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 50%, rgba(196,131,42,.08), transparent 60%), linear-gradient(180deg, #1A1106, #0D0A06)',
      borderBottom: `1px solid ${MR_PALETTE.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -20,
      backgroundImage: `linear-gradient(rgba(61,43,14,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(61,43,14,.35) 1px, transparent 1px)`,
      backgroundSize: '40px 40px',
      maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)'
    }
  }), [80, 140, 200].map(r => /*#__PURE__*/React.createElement("div", {
    key: r,
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: r,
      height: r,
      marginLeft: -r / 2,
      marginTop: -r / 2,
      borderRadius: '50%',
      border: `1px dashed ${MR_PALETTE.copper}33`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: pin('50%', '50%', 24)
  }, /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r1",
    style: {
      width: 24,
      height: 24,
      top: 0,
      left: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r2",
    style: {
      width: 24,
      height: 24,
      top: 0,
      left: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "radar-mini r3",
    style: {
      width: 24,
      height: 24,
      top: 0,
      left: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      border: `2.5px solid ${MR_PALETTE.text}`,
      boxShadow: `0 0 18px ${MR_PALETTE.copper}cc`,
      position: 'absolute',
      top: 5,
      left: 5,
      zIndex: 2
    }
  })), visible.slice(0, 5).map((u, i) => /*#__PURE__*/React.createElement("div", {
    key: u.id,
    onClick: () => onOpenUser(u),
    style: {
      ...pin(`${[28, 70, 65, 38, 76][i]}%`, `${[38, 30, 72, 78, 60][i]}%`, 36),
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(PulsingAvatar, {
    name: u.name,
    pulsing: u.pulsing,
    verified: u.verified,
    size: 36
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'flex',
      gap: 6
    }
  }, [1, 5, 25].map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    onClick: () => setRadius(r),
    style: {
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: radius === r ? MR_PALETTE.copper : 'rgba(13,10,6,.7)',
      color: radius === r ? '#1A0E03' : MR_PALETTE.text,
      border: `1px solid ${radius === r ? 'transparent' : MR_PALETTE.border}`,
      backdropFilter: 'blur(10px)',
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, r, " MI"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 10,
      left: 14,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: MR_PALETTE.muted
    }
  }, "\u25CF LIVE \xB7 ", visible.length, " IN RANGE"), mapToggleBtn('up', {
    bottom: 8,
    right: 10
  }))), !mapOpen && mapToggleBtn('down', {
    top: 6,
    right: 10
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px 10px',
      paddingRight: mapOpen ? 16 : 48,
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: MR_PALETTE.text,
      letterSpacing: '-0.005em'
    }
  }, visible.length, " men nearby"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSort(s => s === 'Distance' ? 'Active' : s === 'Active' ? 'Age' : 'Distance'),
    style: {
      background: 'transparent',
      border: 0,
      color: MR_PALETTE.copper,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Sort \xB7 ", sort)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 12px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, visible.map(u => /*#__PURE__*/React.createElement(UserCard, {
    key: u.id,
    user: u,
    onClick: () => onOpenUser(u)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 30
    }
  }));
}
const iconBtn = highlight => ({
  width: 38,
  height: 38,
  borderRadius: 999,
  border: 0,
  cursor: 'pointer',
  background: highlight ? `${MR_PALETTE.copper}22` : 'transparent',
  color: highlight ? MR_PALETTE.copper : MR_PALETTE.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});
const pin = (left, top, size) => ({
  position: 'absolute',
  left,
  top,
  width: size,
  height: size,
  transform: 'translate(-50%, -50%)',
  zIndex: 5
});

// ── User card on the grid ────────────────────────────────────
function UserCard({
  user,
  onClick
}) {
  const photoBg = 'linear-gradient(160deg, #3D2B0E 0%, #1E1508 70%)';
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: MR_PALETTE.card,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      padding: 0,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'left',
      boxShadow: '0 4px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,200,130,.06)',
      fontFamily: 'inherit',
      color: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '3/4',
      background: photoBg,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(196,131,42,.1)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 44,
    strokeWidth: 1.5
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: 6,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 4,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    pulsing: user.pulsing,
    online: user.online,
    lastSeen: user.lastSeen,
    size: "xs",
    dotOnly: true
  }), /*#__PURE__*/React.createElement(DistancePill, {
    mi: user.distMi,
    size: "xs"
  })), user.verified && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      border: `2px solid ${MR_PALETTE.card}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 12px ${MR_PALETTE.copper}88`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 10,
    strokeWidth: 3,
    style: {
      color: '#1A0E03'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(to top, ${MR_PALETTE.card} 0%, transparent 35%)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 9px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: MR_PALETTE.text,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, user.name, /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.muted,
      fontWeight: 400,
      marginLeft: 4
    }
  }, user.age)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, user.tribes.slice(0, 2).map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontSize: 9,
      padding: '2px 6px',
      borderRadius: 999,
      background: 'rgba(196,131,42,.1)',
      color: MR_PALETTE.copper,
      border: `1px solid ${MR_PALETTE.copper}33`
    }
  }, t)))));
}

// ── Profile drawer (bottom sheet) ────────────────────────────
function ProfileDrawer({
  user,
  onClose,
  onOpenChat,
  onVideoCall
}) {
  const [flagged, setFlagged] = React.useState(null); // 'blocked' | 'reported'
  if (!user) return null;
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTop: `1px solid ${MR_PALETTE.border}`,
      boxShadow: '0 -24px 64px rgba(0,0,0,.7)',
      maxHeight: '90%',
      overflowY: 'auto',
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      paddingBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '10px 0 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: MR_PALETTE.border
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 240,
      margin: '12px 16px 0',
      borderRadius: 18,
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #3D2B0E 0%, #1E1508 80%)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'rgba(196,131,42,.15)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 120,
    strokeWidth: 1.4
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 999,
      background: 'rgba(13,10,6,.7)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${MR_PALETTE.border}`,
      color: MR_PALETTE.text,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18,
    strokeWidth: 2.2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 12
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    pulsing: user.pulsing,
    online: user.online,
    lastSeen: user.lastSeen
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 12,
      left: 12
    }
  }, /*#__PURE__*/React.createElement(DistancePill, {
    mi: user.distMi
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 900,
      fontSize: 26,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, user.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: MR_PALETTE.muted,
      fontWeight: 400
    }
  }, user.age), user.verified && /*#__PURE__*/React.createElement(VerifiedBadge, null)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: MR_PALETTE.text,
      opacity: .85,
      lineHeight: 1.5,
      marginTop: 8,
      marginBottom: 0
    }
  }, user.bio)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '14px 20px 0',
      flexWrap: 'wrap'
    }
  }, user.tribes.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: tribeChip
  }, t)), /*#__PURE__*/React.createElement("span", {
    style: {
      ...tribeChip,
      background: 'rgba(212,162,76,.12)',
      color: MR_PALETTE.warning,
      borderColor: 'rgba(212,162,76,.35)'
    }
  }, "\u21A6 ", user.mood)), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '20px 20px 0',
      padding: '14px 16px',
      background: MR_PALETTE.elevated,
      borderRadius: 14,
      border: `1px solid ${MR_PALETTE.border}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 12
    }
  }, [['Height', '6\'1"'], ['Body', 'Muscular'], ['Position', 'Top']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.16em',
      color: MR_PALETTE.muted,
      textTransform: 'uppercase'
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: MR_PALETTE.text,
      marginTop: 3
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 0',
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: () => onOpenChat(user)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chat",
    size: 16,
    strokeWidth: 2.2
  }), " OPEN CHAT")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onVideoCall && onVideoCall(user),
    title: "Video call",
    style: {
      width: 50,
      height: 50,
      borderRadius: 999,
      background: 'transparent',
      border: `1px solid ${MR_PALETTE.border}`,
      color: MR_PALETTE.text,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "video",
    size: 20,
    strokeWidth: 2
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 18,
      marginTop: 12
    }
  }, flagged ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: MR_PALETTE.copper,
      letterSpacing: '0.04em'
    }
  }, flagged === 'blocked' ? 'Blocked. They can\u2019t see or message you.' : 'Reported. We\u2019ll review within 24h.') : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setFlagged('blocked');
      setTimeout(onClose, 1200);
    },
    style: {
      background: 'transparent',
      border: 0,
      color: MR_PALETTE.faint,
      fontSize: 11.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      letterSpacing: '0.04em'
    }
  }, "Block"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.faint,
      fontSize: 11.5
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setFlagged('reported');
      setTimeout(onClose, 1200);
    },
    style: {
      background: 'transparent',
      border: 0,
      color: MR_PALETTE.faint,
      fontSize: 11.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      letterSpacing: '0.04em'
    }
  }, "Report")))));
}
const tribeChip = {
  padding: '5px 11px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(196,131,42,.1)',
  color: MR_PALETTE.copper,
  border: `1px solid ${MR_PALETTE.copper}40`
};

// ── Chat thread ──────────────────────────────────────────────
function ChatScreen({
  user,
  onBack,
  onOpenUser,
  premium = false
}) {
  const [messages, setMessages] = React.useState([{
    mine: false,
    text: 'Saw your pulse. Where are you?',
    time: '9:42 PM'
  }, {
    mine: true,
    text: 'Stonewall. Back patio.',
    time: '9:43 PM',
    seen: true
  }, {
    mine: false,
    text: 'On my way. 5 min.',
    time: '9:43 PM'
  }, {
    mine: false,
    voice: {
      dur: '0:09'
    },
    time: '9:44 PM'
  }, {
    mine: false,
    video: {
      dur: '0:15'
    },
    time: '9:45 PM'
  }]);
  const [draft, setDraft] = React.useState('');
  const [attach, setAttach] = React.useState(null); // null | { viewOnce: boolean }
  const [gate, setGate] = React.useState(null); // null | premium-gate variant
  const [calling, setCalling] = React.useState(false);
  const scrollRef = React.useRef(null);
  const scrollDown = () => setTimeout(() => {
    scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
  }, 50);
  const send = () => {
    if (attach) {
      setMessages(m => [...m, {
        mine: true,
        img: {
          viewOnce: attach.viewOnce,
          viewed: false
        },
        time: 'now',
        seen: false
      }]);
      setAttach(null);
      scrollDown();
      if (!draft.trim()) return;
    }
    if (!draft.trim()) return;
    setMessages(m => [...m, {
      mine: true,
      text: draft.trim(),
      time: 'now',
      seen: false
    }]);
    setDraft('');
    scrollDown();
  };
  const openImage = i => {
    setMessages(m => m.map((msg, idx) => idx === i && msg.img ? {
      ...msg,
      img: {
        ...msg.img,
        viewed: true
      }
    } : msg));
  };
  const sendVoice = () => {
    setMessages(m => [...m, {
      mine: true,
      voice: {
        dur: '0:11'
      },
      time: 'now',
      seen: false
    }]);
    scrollDown();
  };
  const sendVideo = () => {
    setMessages(m => [...m, {
      mine: true,
      video: {
        dur: '0:08'
      },
      time: 'now',
      seen: false
    }]);
    scrollDown();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: MR_PALETTE.bg,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    left: /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: iconBtn()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 22,
      strokeWidth: 2.2
    })),
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => premium ? setCalling(true) : setGate('video-call'),
      title: "Video call",
      style: iconBtn()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "video",
      size: 20,
      strokeWidth: 1.8,
      style: {
        color: MR_PALETTE.copper
      }
    })), /*#__PURE__*/React.createElement(MoreMenu, {
      style: iconBtn(),
      items: [{
        label: 'View profile',
        onClick: () => onOpenUser(user)
      }, {
        label: 'Mute notifications'
      }, {
        label: 'Report',
        danger: true
      }, {
        label: 'Block',
        danger: true
      }]
    }))
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenUser(user),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: MR_PALETTE.card,
      borderBottom: `1px solid ${MR_PALETTE.border}`,
      border: 'none',
      width: '100%',
      cursor: 'pointer',
      fontFamily: 'inherit',
      color: 'inherit',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(PulsingAvatar, {
    name: user.name,
    pulsing: user.pulsing,
    verified: user.verified,
    size: 42
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: MR_PALETTE.text
    }
  }, user.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.muted,
      fontSize: 13
    }
  }, user.age)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: user.online ? MR_PALETTE.online : MR_PALETTE.muted,
      marginTop: 1
    }
  }, user.pulsing ? 'Pulsing now' : user.online ? 'Active now' : `Last seen ${user.lastSeen}`, " \xB7 ", user.distMi < 1 ? `${Math.round(user.distMi * 1760)} yd` : `${user.distMi.toFixed(1)} mi`)), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 18,
    strokeWidth: 2,
    style: {
      color: MR_PALETTE.muted,
      transform: 'rotate(-90deg)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    className: "scroll",
    style: {
      flex: 1,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      margin: '6px 0 14px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em',
      color: MR_PALETTE.faint
    }
  }, "TODAY \xB7 9:42 PM")), messages.map((m, i) => m.voice ? /*#__PURE__*/React.createElement(VoiceBubble, {
    key: i,
    mine: m.mine,
    dur: m.voice.dur,
    time: m.time
  }) : m.video ? /*#__PURE__*/React.createElement(VideoBubble, {
    key: i,
    mine: m.mine,
    dur: m.video.dur,
    time: m.time,
    locked: !premium && !m.mine,
    onLockedTap: () => setGate('video-note')
  }) : m.img ? /*#__PURE__*/React.createElement(ImageBubble, {
    key: i,
    mine: m.mine,
    img: m.img,
    time: m.time,
    onOpen: () => openImage(i)
  }) : /*#__PURE__*/React.createElement(MessageBubble, {
    key: i,
    mine: m.mine,
    time: m.time,
    seen: m.seen
  }, m.text)), !premium && /*#__PURE__*/React.createElement("button", {
    onClick: () => setGate('video-note'),
    style: {
      margin: '2px auto 0',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 10.5,
      color: MR_PALETTE.faint,
      letterSpacing: '0.04em'
    }
  }, "Video notes are for ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: MR_PALETTE.copper,
      fontWeight: 700
    }
  }, "Premium"), " members \u2014 upgrade to watch")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px 38px',
      background: 'rgba(13,10,6,.92)',
      borderTop: `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, attach && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 12,
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 8,
      flexShrink: 0,
      background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(196,131,42,.5)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 20,
    strokeWidth: 1.6
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 12,
      color: MR_PALETTE.muted
    }
  }, "Photo ready"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttach(a => ({
      viewOnce: !a.viewOnce
    })),
    style: {
      padding: '6px 12px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      fontFamily: 'inherit',
      cursor: 'pointer',
      background: attach.viewOnce ? MR_PALETTE.copper : 'transparent',
      color: attach.viewOnce ? '#1A0E03' : MR_PALETTE.muted,
      border: `1px solid ${attach.viewOnce ? 'transparent' : MR_PALETTE.border}`
    }
  }, "\u2460 VIEW ONCE"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttach(null),
    style: {
      width: 28,
      height: 28,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: 'transparent',
      color: MR_PALETTE.muted,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16,
    strokeWidth: 2.2
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttach(a => a || {
      viewOnce: false
    }),
    title: "Camera",
    style: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      flexShrink: 0,
      background: 'transparent',
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "camera",
    size: 19,
    strokeWidth: 1.8
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttach(a => a || {
      viewOnce: false
    }),
    title: "Attach photo",
    style: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      flexShrink: 0,
      background: 'transparent',
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 19,
    strokeWidth: 1.8
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => premium ? sendVoice() : setGate('media'),
    title: "Voice note",
    style: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      flexShrink: 0,
      background: 'transparent',
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mic",
    size: 19,
    strokeWidth: 1.8
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => premium ? sendVideo() : setGate('media'),
    title: "Video note",
    style: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      flexShrink: 0,
      background: 'transparent',
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "video",
    size: 19,
    strokeWidth: 1.8
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 999,
      padding: '6px 6px 6px 18px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => e.key === 'Enter' && send(),
    placeholder: "Say something direct\u2026",
    style: {
      flex: 1,
      background: 'transparent',
      border: 0,
      outline: 'none',
      color: MR_PALETTE.text,
      fontSize: 14,
      fontFamily: 'inherit',
      padding: '6px 0'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: send,
    style: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      background: MR_PALETTE.copper,
      color: '#1A0E03',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 16px ${MR_PALETTE.copper}66`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 16
  }))))), gate && /*#__PURE__*/React.createElement(window.PremiumGate, {
    variant: gate,
    onClose: () => setGate(null)
  }), calling && /*#__PURE__*/React.createElement(window.VideoCallModal, {
    user: user,
    state: "active",
    onClose: () => setCalling(false),
    onHangup: () => setCalling(false)
  }));
}

// ── Voice note bubble — waveform + play, audible for everyone ──
const MR_WAVE = [5, 9, 14, 8, 12, 16, 10, 6, 11, 15, 9, 5, 8, 13, 7, 10, 14, 6, 9, 12];
function VoiceBubble({
  mine,
  dur = '0:12',
  time
}) {
  const [playing, setPlaying] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: mine ? 'flex-end' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      maxWidth: '75%',
      background: mine ? 'linear-gradient(135deg, #C4832A, #8B4513)' : MR_PALETTE.elevated,
      border: mine ? 'none' : `1px solid ${MR_PALETTE.border}`,
      borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPlaying(p => !p),
    title: playing ? 'Pause' : 'Play',
    style: {
      width: 30,
      height: 30,
      borderRadius: 999,
      border: 0,
      cursor: 'pointer',
      flexShrink: 0,
      background: mine ? 'rgba(26,14,3,.85)' : MR_PALETTE.copper,
      color: mine ? MR_PALETTE.copper : '#1A0E03',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: playing ? 'pause' : 'play',
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2.5,
      height: 18
    }
  }, MR_WAVE.map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 2.5,
      height: h,
      borderRadius: 2,
      background: mine ? 'rgba(26,14,3,.7)' : `${MR_PALETTE.copper}cc`
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontFamily: 'ui-monospace, monospace',
      color: mine ? 'rgba(26,14,3,.7)' : MR_PALETTE.muted,
      flexShrink: 0
    }
  }, dur, " \xB7 ", time)));
}

// ── Video note bubble — premium plays; non-premium sees blur + logo ──
function VideoBubble({
  mine,
  dur = '0:15',
  time,
  locked,
  onLockedTap
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: mine ? 'flex-end' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => locked && onLockedTap && onLockedTap(),
    style: {
      width: 160,
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(160deg, #3D2B0E, #1E1508)',
      border: `1px solid ${mine ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
      cursor: locked ? 'pointer' : 'default'
    }
  }, locked ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(circle at 40% 30%, #6B4A16, #241804 70%)',
      filter: 'blur(14px)',
      transform: 'scale(1.2)'
    }
  }), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/menrush-logo.png",
    alt: "",
    draggable: "false",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      opacity: .28,
      padding: 26,
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 14,
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 999,
      background: 'rgba(13,10,6,.75)',
      border: `1px solid ${MR_PALETTE.copper}88`,
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 15,
    strokeWidth: 2
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.14em',
      color: MR_PALETTE.copper,
      textShadow: '0 1px 6px rgba(0,0,0,.8)'
    }
  }, "VIDEO \xB7 PREMIUM ONLY"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 999,
      background: 'rgba(13,10,6,.6)',
      border: `1.5px solid ${MR_PALETTE.copper}`,
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 8,
      padding: '3px 8px',
      borderRadius: 999,
      background: 'rgba(13,10,6,.75)',
      color: MR_PALETTE.copper,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      display: 'inline-flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "video",
    size: 10,
    strokeWidth: 2
  }), " ", dur), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 6,
      right: 10,
      fontSize: 9.5,
      color: 'rgba(240,224,192,.65)'
    }
  }, time))));
}

// ── Image bubble — normal or view-once ────────────────────
function ImageBubble({
  mine,
  img,
  time,
  onOpen
}) {
  const locked = img.viewOnce && img.viewed;
  const hidden = img.viewOnce && !img.viewed;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: mine ? 'flex-end' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => hidden && onOpen(),
    style: {
      width: 160,
      height: locked ? 56 : 200,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      background: locked ? MR_PALETTE.elevated : 'linear-gradient(160deg, #3D2B0E, #1E1508)',
      border: `1px solid ${mine ? `${MR_PALETTE.copper}55` : MR_PALETTE.border}`,
      cursor: hidden ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 6
    }
  }, locked ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: MR_PALETTE.faint,
      fontSize: 11,
      fontWeight: 600
    }
  }, "\u2460 Opened \xB7 expired") : hidden ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: `${MR_PALETTE.copper}22`,
      border: `1.5px solid ${MR_PALETTE.copper}`,
      color: MR_PALETTE.copper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      fontWeight: 800
    }
  }, "\u2460"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.14em',
      color: MR_PALETTE.copper
    }
  }, "TAP TO VIEW ONCE")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(196,131,42,.18)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 48,
    strokeWidth: 1.2
  })), img.viewOnce && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 8,
      padding: '3px 8px',
      borderRadius: 999,
      background: 'rgba(13,10,6,.75)',
      color: MR_PALETTE.copper,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em'
    }
  }, "\u2460 VIEW ONCE"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 6,
      right: 10,
      fontSize: 9.5,
      color: 'rgba(240,224,192,.65)'
    }
  }, time))));
}

// ── Premium gate modal ───────────────────────────────────────
function PremiumGate({
  onClose
}) {
  return /*#__PURE__*/React.createElement(Scrim, {
    onClose: onClose,
    style: {
      alignItems: 'center',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      borderRadius: 20,
      border: `1px solid ${MR_PALETTE.copper}50`,
      boxShadow: `0 24px 80px rgba(0,0,0,.85), 0 0 60px ${MR_PALETTE.copper}33`,
      animation: 'nn-slide-up .35s cubic-bezier(.16,1,.3,1)',
      margin: '0 auto',
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 24px 18px',
      textAlign: 'center',
      position: 'relative',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: 'url(../../assets/menrush-logo.png)',
      backgroundSize: '260px',
      backgroundPosition: 'center 30%',
      backgroundRepeat: 'no-repeat',
      opacity: .16,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.22em',
      color: MR_PALETTE.copper
    }
  }, "MENRUSH PREMIUM"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '12px 0 4px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: MR_PALETTE.text
    }
  }, "3 men liked you."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: MR_PALETTE.muted,
      margin: 0
    }
  }, "See them. Open chat. Skip the queue."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 24px 22px'
    }
  }, ['See who liked you', 'Expand radius to 30 miles', 'Message without matching', 'Boost — top of nearby for 30 min', 'Incognito · advanced filters'].map(perk => /*#__PURE__*/React.createElement("div", {
    key: perk,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      fontSize: 14,
      color: MR_PALETTE.text
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      flexShrink: 0
    }
  }), perk)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onClose
  }, "UNLOCK \xB7 $9.99/MO")), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: MR_PALETTE.faint,
      marginTop: 12
    }
  }, "Cancel anytime."))));
}
Object.assign(window, {
  DiscoverScreen,
  ProfileDrawer,
  ChatScreen,
  UserCard,
  MR_USERS,
  VoiceBubble,
  VideoBubble,
  ImageBubble
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/menrush_app/verify.jsx
try { (() => {
// MenRush — ID verification flow.
// Five stages: intro · capture · selfie · pending · verified.
// Verified badge is FREE FOR ALL — not a premium gate. Trust signal.
// Globals: MR_PALETTE, Icon, Button, TopBar, VerifiedBadge

function VerifyFlow({
  stage: initial = 'intro',
  onBack,
  onAdvance
}) {
  const [stage, setStage] = React.useState(initial);
  const next = s => setStage(s);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: MR_PALETTE.bg,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    left: /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: vIconBtn
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 22,
      strokeWidth: 2.2
    })),
    title: "VERIFY ID"
  }), stage === 'intro' && /*#__PURE__*/React.createElement(VerifyIntro, {
    onCapture: () => next('capture')
  }), stage === 'capture' && /*#__PURE__*/React.createElement(VerifyCapture, {
    onTakeSelfie: () => next('selfie'),
    onBack: () => next('intro')
  }), stage === 'selfie' && /*#__PURE__*/React.createElement(VerifySelfie, {
    onSubmit: () => next('pending'),
    onBack: () => next('capture')
  }), stage === 'pending' && /*#__PURE__*/React.createElement(VerifyPending, {
    onCheck: () => next('verified')
  }), stage === 'verified' && /*#__PURE__*/React.createElement(VerifyDone, {
    onAdvance: onAdvance
  }));
}
const vIconBtn = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: 0,
  cursor: 'pointer',
  background: 'transparent',
  color: MR_PALETTE.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const verifyScroll = {
  flex: 1,
  padding: '24px 22px 30px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column'
};

// ── Intro / explainer ───────────────────────────────────────
function VerifyIntro({
  onCapture
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: verifyScroll
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 10,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 92,
      height: 92,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 40px ${MR_PALETTE.copper}66, inset 0 1px 0 rgba(255,220,170,.4)`,
      color: '#1A0E03'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 42,
    strokeWidth: 2
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: vEyebrow
  }, "VERIFIED IS FREE \xB7 ALWAYS"), /*#__PURE__*/React.createElement("h2", {
    style: vH2
  }, "Prove you're you."), /*#__PURE__*/React.createElement("p", {
    style: vSub
  }, "Snap your ID, then a selfie. We compare them and delete the documents after review. You get a copper checkmark on your card. Verified men tend to get more replies.")), /*#__PURE__*/React.createElement("div", {
    style: vRow
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: vRowT
  }, "Free, forever"), /*#__PURE__*/React.createElement("div", {
    style: vRowD
  }, "Verification is never behind a paywall."))), /*#__PURE__*/React.createElement("div", {
    style: vRow
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: vRowT
  }, "Documents auto-deleted"), /*#__PURE__*/React.createElement("div", {
    style: vRowD
  }, "ID photo + selfie are removed after the badge is issued."))), /*#__PURE__*/React.createElement("div", {
    style: vRow
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.copper,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: vRowT
  }, "Your age is the only data kept"), /*#__PURE__*/React.createElement("div", {
    style: vRowD
  }, "Name + DOB confirm 18+. Nothing else."))), /*#__PURE__*/React.createElement("div", {
    style: vRow
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16,
    strokeWidth: 2.4,
    style: {
      color: MR_PALETTE.faint,
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...vRowT,
      color: MR_PALETTE.muted
    }
  }, "Never shown to other users"), /*#__PURE__*/React.createElement("div", {
    style: vRowD
  }, "Profiles only ever see the copper checkmark, not your documents."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onCapture
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 16,
    strokeWidth: 2.2
  }), " START VERIFICATION")), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: MR_PALETTE.faint,
      marginTop: 10
    }
  }, "Takes about 60 seconds.")));
}

// ── ID capture (camera viewfinder mock) ─────────────────────
function VerifyCapture({
  onTakeSelfie,
  onBack
}) {
  const [side, setSide] = React.useState('front');
  return /*#__PURE__*/React.createElement("div", {
    style: verifyScroll
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: vEyebrow
  }, "STEP 1 OF 2"), /*#__PURE__*/React.createElement("h2", {
    style: vH2
  }, "Front of your ID."), /*#__PURE__*/React.createElement("p", {
    style: vSub
  }, "Driver's license, passport, or national ID. Fill the frame.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      aspectRatio: '1.6/1',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #1A1106 0%, #0D0A06 100%)',
      border: `1px solid ${MR_PALETTE.border}`,
      marginBottom: 18
    }
  }, [[0, 0, 'tl'], [0, 1, 'tr'], [1, 0, 'bl'], [1, 1, 'br']].map(([y, x, k]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      position: 'absolute',
      [y ? 'bottom' : 'top']: 14,
      [x ? 'right' : 'left']: 14,
      width: 26,
      height: 26,
      borderTop: y ? 0 : `2px solid ${MR_PALETTE.copper}`,
      borderBottom: y ? `2px solid ${MR_PALETTE.copper}` : 0,
      borderLeft: x ? 0 : `2px solid ${MR_PALETTE.copper}`,
      borderRight: x ? `2px solid ${MR_PALETTE.copper}` : 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 32,
      right: 32,
      top: 32,
      bottom: 32,
      border: `1px dashed ${MR_PALETTE.copper}55`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: MR_PALETTE.muted
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 32,
    strokeWidth: 1.4,
    style: {
      opacity: .4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em'
    }
  }, "POSITION ID INSIDE FRAME"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSide('front'),
    style: side === 'front' ? vChip : vChipOff
  }, "FRONT"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSide('back'),
    style: side === 'back' ? vChip : vChipOff
  }, "BACK")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      alignItems: 'center',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: vTextBtn
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: onTakeSelfie,
    "aria-label": "Capture",
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      border: `4px solid ${MR_PALETTE.bg}`,
      boxShadow: `0 0 0 2px ${MR_PALETTE.copper}, 0 0 32px ${MR_PALETTE.copper}88`,
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onTakeSelfie,
    style: vTextBtn
  }, "Use file")), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: MR_PALETTE.faint,
      marginTop: 14
    }
  }, "Tip \u2014 flat surface, soft light, no glare."));
}

// ── Selfie capture ──────────────────────────────────────────
function VerifySelfie({
  onSubmit,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: verifyScroll
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: vEyebrow
  }, "STEP 2 OF 2"), /*#__PURE__*/React.createElement("h2", {
    style: vH2
  }, "Selfie."), /*#__PURE__*/React.createElement("p", {
    style: vSub
  }, "Hold steady. Face the camera. No filters.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      aspectRatio: '1/1',
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 40%, #2A1C0A 0%, #0D0A06 80%)',
      border: `2px dashed ${MR_PALETTE.copper}66`,
      marginBottom: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8,
      color: MR_PALETTE.muted,
      maxWidth: 260,
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 80,
    strokeWidth: 1.2,
    style: {
      opacity: .35
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.2em'
    }
  }, "CENTER YOUR FACE")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: vTextBtn
  }, "Retake ID"), /*#__PURE__*/React.createElement("button", {
    onClick: onSubmit,
    "aria-label": "Capture",
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      border: `4px solid ${MR_PALETTE.bg}`,
      boxShadow: `0 0 0 2px ${MR_PALETTE.copper}, 0 0 32px ${MR_PALETTE.copper}88`,
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onSubmit,
    style: vTextBtn
  }, "Skip")));
}

// ── Pending review ──────────────────────────────────────────
function VerifyPending({
  onCheck
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: verifyScroll
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 96,
      height: 96,
      borderRadius: '50%',
      background: MR_PALETTE.elevated,
      border: `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Spinner, {
    size: 42
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: vEyebrow
  }, "UNDER REVIEW"), /*#__PURE__*/React.createElement("h2", {
    style: vH2
  }, "Hang tight."), /*#__PURE__*/React.createElement("p", {
    style: vSub
  }, "We're checking your documents. Usually ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: MR_PALETTE.text
    }
  }, "under 2 minutes"), ", sometimes a few hours during off-peak.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Step, {
    label: "Capture ID",
    done: true
  }), /*#__PURE__*/React.createElement(Step, {
    label: "Take selfie",
    done: true
  }), /*#__PURE__*/React.createElement(Step, {
    label: "Review documents",
    pending: true
  }), /*#__PURE__*/React.createElement(Step, {
    label: "Issue badge"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: MR_PALETTE.muted,
      lineHeight: 1.5,
      marginBottom: 18
    }
  }, "We'll send you a notification the moment it's done. You can keep using the app while you wait \u2014 your card just won't show the badge yet."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    full: true,
    onClick: onCheck
  }, "CHECK STATUS")));
}
function Step({
  label,
  done,
  pending
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      flexShrink: 0,
      background: done ? MR_PALETTE.copper : pending ? 'transparent' : MR_PALETTE.elevated,
      border: pending ? `2px solid ${MR_PALETTE.copper}` : done ? 'none' : `1px solid ${MR_PALETTE.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: done ? `0 0 8px ${MR_PALETTE.copper}88` : 'none',
      animation: pending ? 'nn-pulse-soft 1.6s ease-in-out infinite' : 'none'
    }
  }, done && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11,
    strokeWidth: 3.5,
    style: {
      color: '#1A0E03'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontWeight: done || pending ? 600 : 400,
      color: done ? MR_PALETTE.text : pending ? MR_PALETTE.copper : MR_PALETTE.muted
    }
  }, label));
}
function Spinner({
  size = 30
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    style: {
      animation: 'spin 1.2s linear infinite'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10",
    stroke: MR_PALETTE.border,
    strokeWidth: "2.5",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 12a10 10 0 0 1-10 10",
    stroke: MR_PALETTE.copper,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    fill: "none"
  }));
}

// ── Verified · success ──────────────────────────────────────
function VerifyDone({
  onAdvance
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: verifyScroll
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 110,
      height: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 24,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      opacity: .5,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 24,
      borderRadius: '50%',
      background: MR_PALETTE.copper,
      opacity: .3,
      animation: 'nn-radar 2.4s cubic-bezier(.16,1,.3,1) .8s infinite'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${MR_PALETTE.copperBright}, ${MR_PALETTE.copper})`,
      border: `3px solid ${MR_PALETTE.bg}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 30px ${MR_PALETTE.copper}aa, inset 0 1px 0 rgba(255,220,170,.4)`,
      color: '#1A0E03'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 32,
    strokeWidth: 3.2
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: vEyebrow
  }, "VERIFIED"), /*#__PURE__*/React.createElement("h2", {
    style: vH2
  }, "You're verified."), /*#__PURE__*/React.createElement("p", {
    style: vSub
  }, "Your card now shows the copper checkmark, and verified men tend to get more replies.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: MR_PALETTE.card,
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 14,
      padding: 18,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(PulsingAvatar, {
    name: "You",
    verified: true,
    size: 56
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: MR_PALETTE.text,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, "Your card \xB7 now ", /*#__PURE__*/React.createElement(VerifiedBadge, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: MR_PALETTE.muted,
      marginTop: 3
    }
  }, "Documents removed after verification."))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    full: true,
    size: "lg",
    onClick: onAdvance
  }, "BACK TO NEARBY")));
}
const vEyebrow = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.22em',
  color: MR_PALETTE.copper
};
const vH2 = {
  margin: '10px 0 8px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: MR_PALETTE.text
};
const vSub = {
  fontSize: 13.5,
  color: MR_PALETTE.muted,
  margin: 0,
  lineHeight: 1.5
};
const vRow = {
  display: 'flex',
  gap: 12,
  padding: '10px 0'
};
const vRowT = {
  fontSize: 13.5,
  fontWeight: 600,
  color: MR_PALETTE.text
};
const vRowD = {
  fontSize: 12,
  color: MR_PALETTE.muted,
  marginTop: 2,
  lineHeight: 1.4
};
const vChip = {
  padding: '6px 14px',
  borderRadius: 999,
  border: 0,
  background: MR_PALETTE.copper,
  color: '#1A0E03',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textTransform: 'uppercase'
};
const vChipOff = {
  ...vChip,
  background: 'transparent',
  color: MR_PALETTE.muted,
  border: `1px solid ${MR_PALETTE.border}`
};
const vTextBtn = {
  background: 'transparent',
  border: 0,
  color: MR_PALETTE.muted,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  padding: '8px 12px'
};
Object.assign(window, {
  VerifyFlow,
  VerifyIntro,
  VerifyCapture,
  VerifySelfie,
  VerifyPending,
  VerifyDone
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/menrush_app/verify.jsx", error: String((e && e.message) || e) }); }

})();
