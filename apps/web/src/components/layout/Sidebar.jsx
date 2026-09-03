import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/analytics", label: "Analytics" },
  { to: "/playground", label: "Playground" },
  { to: "/policies", label: "Policies" },
  { to: "/destinations", label: "Destinations" },
  { to: "/approvals", label: "Approvals" },
  { to: "/audit", label: "Audit Logs" },
  { to: "/organization", label: "Organization" }
];

export function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">DataFlow Guardian</div>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}