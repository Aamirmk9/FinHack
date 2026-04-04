import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '\u25C9' },
  { to: '/network', label: 'Network Explorer', icon: '\u25CE' },
  { to: '/investigation', label: 'Investigation', icon: '\u2691' },
  { to: '/timeline', label: 'Timeline', icon: '\u25F7' },
];

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Glassmorphism Sidebar */}
      <nav className="w-60 flex-shrink-0 flex flex-col glass" style={{ borderRight: '1px solid var(--glass-border)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
            <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--accent-cyan)' }}>
              ShadowTrace
            </h1>
          </div>
          <p className="text-xs mt-1.5 tracking-wider uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em' }}>
            Financial Intelligence
          </p>
        </div>
        <div className="flex-1 py-3">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-all duration-200 ${isActive ? 'font-semibold' : ''}`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(6, 182, 212, 0.06)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                boxShadow: isActive ? 'inset 0 0 30px rgba(6, 182, 212, 0.03)' : 'none',
              })}
            >
              <span className="text-base opacity-70">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--risk-low)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pipeline Active</span>
          </div>
          <p className="text-xs mt-1 opacity-40">FinHack 2026</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6 relative" style={{ background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
}
