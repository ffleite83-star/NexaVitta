'use client'

import { motion } from 'framer-motion'

export default function Trajectory() {
  const d = 'M79 398 C196 369 206 165 366 213 C506 255 448 392 671 108'

  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="Uma trajetória com três pontos conectados por uma linha curva">
      <svg viewBox="0 0 740 510" role="img" aria-hidden="true" className="w-full">
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C0D2A2" />
            <stop offset="55%" stopColor="#6599A2" />
            <stop offset="100%" stopColor="#5967A6" />
          </linearGradient>
        </defs>
        <motion.path
          d={d}
          fill="none"
          stroke="url(#path-gradient)"
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
        {[
          { cx: 79, cy: 398, color: '#C0D2A2', delay: 0.1, label: 'começar' },
          { cx: 366, cy: 213, color: '#6599A2', delay: 0.7, label: 'conhecer' },
          { cx: 671, cy: 108, color: '#5967A6', delay: 1.3, label: 'continuar' },
        ].map((n) => (
          <motion.circle
            key={n.label}
            cx={n.cx}
            cy={n.cy}
            r={9}
            fill="#f6f5ef"
            stroke={n.color}
            strokeWidth={5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: n.delay }}
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-2 text-xs text-ink-soft">
        <span>começar</span>
        <span>conhecer</span>
        <span>continuar</span>
      </div>
    </div>
  )
}
