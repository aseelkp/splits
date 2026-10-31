import { formatWeight, plateColor, UNITS } from '../lib/units'

// One round button per plate in this unit. Tapping adds that plate to each side of the bar.
// Bigger plate, bigger button; the number is printed on it.

export default function PlateButtons({ unit, onAdd }) {
  const { plates } = UNITS[unit]
  return (
    <div className="plate-buttons" role="group" aria-label={`Add plates, ${unit}`}>
      {plates.map((p, i) => {
        const d = Math.max(48, 66 - i * 4)
        return (
          <button
            key={p}
            type="button"
            className={`plate-btn plate-${plateColor(p, unit)}`}
            style={{ width: `${d / 16}rem`, height: `${d / 16}rem`, fontSize: d > 56 ? '1.375rem' : d > 50 ? '1.125rem' : '0.9375rem' }}
            aria-label={`Add a ${formatWeight(p)} ${unit} plate to each side`}
            onClick={() => onAdd(p)}
          >
            {formatWeight(p)}
          </button>
        )
      })}
    </div>
  )
}
