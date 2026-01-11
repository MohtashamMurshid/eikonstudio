"use client"

export function StripedDivider() {
  return (
    <div
      className="h-3 dark:opacity-30"
      style={{
        background: `repeating-linear-gradient(
          -45deg,
          var(--border),
          var(--border) 4px,
          var(--background) 4px,
          var(--background) 8px
        )`,
      }}
    />
  );
}

