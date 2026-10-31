const POINTS =
  '80,4 96.6,18.2 118,14.2 125.3,34.7 145.8,42 141.8,63.4 156,80 141.8,96.6 145.8,118 125.3,125.3 118,145.8 96.6,141.8 80,156 63.4,141.8 42,145.8 34.7,125.3 14.2,118 18.2,96.6 4,80 18.2,63.4 14.2,42 34.7,34.7 42,14.2 63.4,18.2'

// A flat starburst sticker. Only shown for a real personal record.
export default function PrSticker({ size = 112, top = 'NEW', main = 'PR', label = 'New personal record' }) {
  const small = size < 100
  return (
    <svg role="img" aria-label={label} className="pr-sticker" width={size} height={size} viewBox="0 0 160 160">
      <polygon points={POINTS} fill="var(--accent)" />
      {top && (
        <text x="80" y="70" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--on-accent)">
          {top}
        </text>
      )}
      <text x="80" y={top ? 116 : small ? 104 : 108} textAnchor="middle" fontSize={top ? 58 : 76} fontWeight="800" fill="var(--on-accent)">
        {main}
      </text>
      {!top && (
        <text x="80" y="134" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--on-accent)">
          PR
        </text>
      )}
    </svg>
  )
}
