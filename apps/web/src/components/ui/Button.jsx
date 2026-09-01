export function Button({ variant = "primary", children, ...props }) {
  const styles = {
    primary: "btn btn-primary",
    danger: "btn btn-danger",
    ghost: "btn btn-ghost"
  };
  return (
    <button className={styles[variant] ?? styles.primary} {...props}>
      {children}
    </button>
  );
}