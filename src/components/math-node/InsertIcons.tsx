import React from "react";

export const InsertAboveIcon = ({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 3v7" />
    <path d="M8.5 6.5h7" />
    <rect x="4" y="15" width="16" height="5" rx="1.5" />
  </svg>
);

export const InsertBelowIcon = ({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="4" y="4" width="16" height="5" rx="1.5" />
    <path d="M12 14v7" />
    <path d="M8.5 17.5h7" />
  </svg>
);
