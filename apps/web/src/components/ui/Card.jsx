export function Card({ title, children, actions }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-header">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}