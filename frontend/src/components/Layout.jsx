import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { to: '/network', label: 'Network', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
    </svg>
  )},
  { to: '/investigation', label: 'Investigate', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )},
  { to: '/timeline', label: 'Timeline', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )},
];

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <nav style={{
        width: 60, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--glass-border)', padding: '14px 0',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: '0 10px' }}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}
              style={({ isActive }) => ({
                width: 40, height: 40, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? '#ef4444' : '#666',
                background: isActive ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                transition: 'all 0.15s', textDecoration: 'none',
              })}>
              {icon}
            </NavLink>
          ))}
        </div>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
      </nav>
      <main className="flex-1 overflow-auto p-5 relative" style={{ background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
}
