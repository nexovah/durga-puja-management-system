// Matches the approved mockup palette (Splash/Login/Home artboards) and the
// web app's own orange/cream brand — same colors, applied via RN
// StyleSheet instead of Tailwind classes.
export const colors = {
  bg: '#faf8f5',
  card: '#ffffff',
  border: '#f1ede7',
  borderStrong: '#eee7dd',
  ink: '#1c1917',
  inkSoft: '#44403c',
  muted: '#78716c',
  mutedLight: '#a8a29e',
  orange: '#ea580c',
  orangeLight: '#fed7aa',
  orangeSoft: '#fff1e6',
  // `dark` stays available for genuine text/icon use (identical to `ink`)
  // — but must NEVER be used as a button fill. Every primary action
  // (Save/Update/Done/confirm) uses `primaryButtonBg` (orange), matching
  // web's single orange-primary-CTA brand convention. See
  // `durga-crm-ui-design-system` skill — web never uses a black/near-
  // black fill for a primary button.
  dark: '#1c1917',
  primaryButtonBg: '#ea580c',
  primaryButtonText: '#ffffff',
  // Neutral Cancel-button fill — promoted from a hardcoded hex that was
  // repeated across 3 form screens, matches web's bg-gray-200 Cancel
  // convention.
  secondaryButtonBg: '#f4f1ec',
  secondaryButtonText: '#1c1917',
  green: '#059669',
  greenBg: '#ecfdf5',
  greenBorder: '#d1fae5',
  greenText: '#065f46',
  amber: '#b45309',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  amberText: '#92400e',
  red: '#b91c1c',
  redBg: '#fee2e2',
  indigo: '#4f46e5',
  indigoBg: '#eef2ff',
  indigoText: '#312e81',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
};

// Soft mesh-gradient hero header tones — orange/cream only (brand stays
// orange-primary, unlike the purple/pink reference screenshots this was
// inspired by). Used by GradientHeader.tsx behind Home/Detail screens'
// top section, mirroring web's .outer-bg-gradient treatment.
export const gradientHero = ['#fff1e6', '#fed7aa', '#ffe8cf'];
