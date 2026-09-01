export function Input({ label, error, ...props }) {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <input className={error ? "input input-error" : "input"} {...props} />
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}