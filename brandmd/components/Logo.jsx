export default function Logo({ size = 40 }) {
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center",
      filter: "drop-shadow(0 4px 12px rgba(91,71,251,.4))" }}>
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="1" y="1" width="38" height="38" rx="12" fill="#17152A" />
        <path d="M7 26 L13 14 L20 23 L27 12 L33 26" fill="none" stroke="#FF6A5A"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="20" y="34" textAnchor="middle" fontSize="8.5" fontWeight="800"
          fill="#fff" fontFamily="ui-sans-serif">MD</text>
      </svg>
    </div>
  );
}
