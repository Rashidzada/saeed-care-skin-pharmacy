import { useId } from 'react'

function Emblem({ ids }) {
  return (
    <g>
      <defs>
        <linearGradient id={ids.panel} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="48%" stopColor="#1d4ed8" />
          <stop offset="52%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#65a30d" />
        </linearGradient>
        <linearGradient id={ids.steel} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={ids.blueFeather} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id={ids.greenFeather} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
        <linearGradient id={ids.capsuleLeft} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={ids.capsuleRight} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>

      <rect x="28" y="28" width="264" height="148" rx="28" fill="#e2e8f0" opacity="0.22" />
      <rect x="24" y="24" width="272" height="152" rx="28" fill={`url(#${ids.panel})`} stroke="#e2e8f0" strokeWidth="4" />
      <path d="M44 48 C112 26, 212 28, 276 60 L276 154 L44 154 Z" fill="#ffffff" opacity="0.12" />

      <g opacity="0.98">
        <path d="M154 88 L166 88 L166 174 L154 174 Z" fill={`url(#${ids.steel})`} stroke="#334155" strokeWidth="1.5" />
        <circle cx="160" cy="52" r="25" fill="#22c55e" stroke="#166534" strokeWidth="4" />
        <rect x="154" y="38" width="12" height="28" rx="2" fill="#ffffff" />
        <rect x="146" y="46" width="28" height="12" rx="2" fill="#ffffff" />

        <g transform="translate(96 94)">
          <path d="M0 0 C-18 -14, -38 -24, -62 -28 C-56 -8, -42 12, -10 28 Z" fill={`url(#${ids.blueFeather})`} stroke="#1d4ed8" strokeWidth="2.5" />
          <path d="M6 -4 C-16 -22, -38 -36, -70 -44 C-64 -22, -48 0, -8 20 Z" fill={`url(#${ids.blueFeather})`} stroke="#1d4ed8" strokeWidth="2.5" opacity="0.96" />
          <path d="M16 -10 C-8 -30, -34 -46, -80 -58 C-74 -34, -56 -8, -6 12 Z" fill={`url(#${ids.blueFeather})`} stroke="#1d4ed8" strokeWidth="2.5" opacity="0.92" />
        </g>

        <g transform="translate(224 94)">
          <path d="M0 0 C18 -14, 38 -24, 62 -28 C56 -8, 42 12, 10 28 Z" fill={`url(#${ids.greenFeather})`} stroke="#4d7c0f" strokeWidth="2.5" />
          <path d="M-6 -4 C16 -22, 38 -36, 70 -44 C64 -22, 48 0, 8 20 Z" fill={`url(#${ids.greenFeather})`} stroke="#4d7c0f" strokeWidth="2.5" opacity="0.96" />
          <path d="M-16 -10 C8 -30, 34 -46, 80 -58 C74 -34, 56 -8, 6 12 Z" fill={`url(#${ids.greenFeather})`} stroke="#4d7c0f" strokeWidth="2.5" opacity="0.92" />
        </g>

        <g transform="translate(160 114) rotate(38)">
          <rect x="-44" y="-20" width="88" height="40" rx="20" fill="#ffffff" opacity="0.28" />
          <path d="M-44 0 a20 20 0 0 1 20 -20 h24 v40 h-24 a20 20 0 0 1 -20 -20 Z" fill={`url(#${ids.capsuleLeft})`} stroke="#1d4ed8" strokeWidth="3" />
          <path d="M0 -20 h24 a20 20 0 0 1 20 20 a20 20 0 0 1 -20 20 h-24 Z" fill={`url(#${ids.capsuleRight})`} stroke="#4d7c0f" strokeWidth="3" />
          <line x1="0" y1="-20" x2="0" y2="20" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
        </g>

        <path
          d="M170 84
             C152 95, 148 109, 158 119
             C171 132, 192 140, 191 155
             C190 169, 176 177, 160 180
             C146 183, 140 192, 142 204"
          fill="none"
          stroke="#22c55e"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M170 86
             C153 96, 150 110, 159 120
             C171 133, 190 140, 189 154
             C188 166, 176 175, 161 178
             C148 181, 143 191, 145 202"
          fill="none"
          stroke="#14532d"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </g>
  )
}

export default function BrandLogo({ variant = 'full', className = '' }) {
  const prefix = useId().replace(/:/g, '')
  const ids = {
    panel: `${prefix}-panel`,
    steel: `${prefix}-steel`,
    blueFeather: `${prefix}-blue-feather`,
    greenFeather: `${prefix}-green-feather`,
    capsuleLeft: `${prefix}-capsule-left`,
    capsuleRight: `${prefix}-capsule-right`,
  }

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 320 200"
        className={className}
        role="img"
        aria-label="Saeed Skin Care Pharmacy logo"
      >
        <Emblem ids={ids} />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 520 340"
      className={className}
      role="img"
      aria-label="Saeed Skin Care Pharmacy logo"
    >
      <g transform="translate(100 0)">
        <Emblem ids={ids} />
      </g>
      <text
        x="260"
        y="248"
        textAnchor="middle"
        fill="#f8fafc"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="68"
        fontWeight="700"
      >
        Saeed
      </text>
      <text
        x="260"
        y="304"
        textAnchor="middle"
        fill="#f8fafc"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="42"
        fontStyle="italic"
        fontWeight="600"
      >
        Skin Care Pharmacy
      </text>
    </svg>
  )
}
