const R = 70
const C = 2 * Math.PI * R

// The big rep counter. Tap once per rep. The lime ring fills toward last time's reps.
// `typing` swaps the counter for a number field, for when tapping is not practical.

export default function RepRing({ reps, last, typing, onTap, onType }) {
  const progress = last ? Math.min(1, reps / last) : 0
  const label = last ? `Count a rep. ${reps} so far. Last time ${last}.` : `Count a rep. ${reps} so far.`

  return (
    <div className="ring-wrap">
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 156 156" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="78" cy="78" r={R} fill="none" stroke="var(--rule)" strokeWidth="9" />
        <circle
          cx="78"
          cy="78"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          transform="rotate(-90 78 78)"
          style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
        />
      </svg>
      {typing ? (
        <>
          <label className="sr-only" htmlFor="reps-typed">
            Reps
          </label>
          <input id="reps-typed" className="reps-input" inputMode="numeric" value={reps || ''} placeholder="0" onChange={(e) => onType(e.target.value)} />
          <span className="ring-label">type the reps</span>
        </>
      ) : (
        <button type="button" className="ring-btn" aria-label={label} onClick={onTap} style={{ position: 'absolute', inset: 0 }}>
          <span className="ring-count">{reps}</span>
          <span className="ring-label">tap per rep</span>
        </button>
      )}
    </div>
  )
}
