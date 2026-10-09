import React, { useId } from 'react';

export interface ExploreCompassIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function ExploreCompassIcon({
  size = 14,
  className = '',
  style,
}: ExploreCompassIconProps) {
  const id = useId().replace(/[:]/g, '');
  const ringGradId = `compass-ring-${id}`;
  const faceGradId = `compass-face-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={ringGradId}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <radialGradient
          id={faceGradId}
          cx="12"
          cy="12"
          r="9.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="60%" stopColor="#0EA5E9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      {/* Outer Dial Face & Gradient Ring */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill={`url(#${faceGradId})`}
        stroke={`url(#${ringGradId})`}
        strokeWidth="1.8"
      />

      {/* 4 Cardinal Dial Marks */}
      <circle cx="12" cy="4" r="0.9" fill="#38BDF8" />
      <circle cx="20" cy="12" r="0.9" fill="#6366F1" />
      <circle cx="12" cy="20" r="0.9" fill="#818CF8" />
      <circle cx="4" cy="12" r="0.9" fill="#38BDF8" />

      {/* North Needle: Red / Coral Facets */}
      <polygon points="17.2,6.8 12,12 10.3,10.3" fill="#EF4444" />
      <polygon points="17.2,6.8 13.7,13.7 12,12" fill="#DC2626" />

      {/* South Needle: Silver / White Facets */}
      <polygon points="6.8,17.2 12,12 10.3,10.3" fill="#FFFFFF" />
      <polygon points="6.8,17.2 13.7,13.7 12,12" fill="#94A3B8" />

      {/* Center Pivot Pin */}
      <circle
        cx="12"
        cy="12"
        r="1.7"
        fill="#F8FAFC"
        stroke="#334155"
        strokeWidth="0.8"
      />
      <circle cx="12" cy="12" r="0.6" fill="#0F172A" />
    </svg>
  );
}

export default ExploreCompassIcon;
