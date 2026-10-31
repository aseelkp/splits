import Icon from './Icon'

// An error is an icon plus words, never colour alone. role="alert" announces it to screen readers.
export default function ErrorLine({ children }) {
  if (!children) return null
  return (
    <div className="error-line" role="alert">
      <Icon name="warning" size={22} />
      <span>{children}</span>
    </div>
  )
}
