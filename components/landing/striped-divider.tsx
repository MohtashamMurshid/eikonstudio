export function StripedDivider() {
  return (
    <div
      className="h-3"
      style={{
        background: `repeating-linear-gradient(
          -45deg,
          #e5e5e5,
          #e5e5e5 4px,
          #f5f5f5 4px,
          #f5f5f5 8px
        )`,
      }}
    />
  );
}

