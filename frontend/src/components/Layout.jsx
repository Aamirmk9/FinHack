import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '\u25C9' },
  { to: '/network', label: 'Network Explorer', icon: '\u25CE' },
  { to: '/investigation', label: 'Investigation', icon: '\u2691' },
  { to: '/timeline', label: 'Timeline', icon: '\u25F7' },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      <nav
        className="w-60 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent-cyan)' }}>
            ShadowTrace
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            AI Money Laundering Detection
          </p>
        </div>
        <div className="flex-1 py-4">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${isActive ? 'font-semibold' : ''}`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                borderRight: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              })}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          FinHack 2026 — Case 1
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
}
