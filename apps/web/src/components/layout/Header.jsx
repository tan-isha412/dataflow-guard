import { useAuth } from "../../hooks/useAuth.js";

export function Header() {
  const { user, organization, logout } = useAuth();

  return (
    <header className="app-header">
      <span>{organization?.name}</span>
      <div className="header-user">
        <span>{user?.fullName}</span>
        <button onClick={logout}>Log out</button>
      </div>
    </header>
  );
}