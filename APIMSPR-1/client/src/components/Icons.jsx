function Svg({ size, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

export function IconDashboard({ size = 18 }) {
  return (
    <Svg size={size}>
      <rect x="3" y="14" width="5" height="7" rx="1"/>
      <rect x="9.5" y="9" width="5" height="12" rx="1"/>
      <rect x="16" y="4" width="5" height="17" rx="1"/>
    </Svg>
  )
}

export function IconUsers({ size = 18 }) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
    </Svg>
  )
}

export function IconFood({ size = 18 }) {
  return (
    <Svg size={size}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>
    </Svg>
  )
}

export function IconUser({ size = 18 }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="7" r="4"/>
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>
    </Svg>
  )
}

export function IconActivity({ size = 18 }) {
  return (
    <Svg size={size}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </Svg>
  )
}

export function IconHome({ size = 18 }) {
  return (
    <Svg size={size}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </Svg>
  )
}

export function IconBowl({ size = 18 }) {
  return (
    <Svg size={size}>
      <path d="M3 11c0 4.4 4 8 9 8s9-3.6 9-8H3z"/>
      <line x1="2" x2="22" y1="11" y2="11"/>
      <path d="M12 3v3"/>
      <path d="M9.5 4.5l.8 2"/>
      <path d="M14.5 4.5l-.8 2"/>
    </Svg>
  )
}

export function IconTrend({ size = 18 }) {
  return (
    <Svg size={size}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </Svg>
  )
}

export function IconEmpty({ size = 40 }) {
  return (
    <Svg size={size}>
      <path d="M22 12h-6l-2 4h-4l-2-4H2"/>
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </Svg>
  )
}
