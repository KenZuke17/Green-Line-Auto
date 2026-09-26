import logoSrc from '../assets/logo.png'

export default function Sidebar({ activeTab, onTabChange }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
    { id: 'inventory', label: 'Inventory', icon: '📦' }
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={logoSrc} alt="Green Line Auto Service logo" className="sidebar-logo" />
        <div className="sidebar-branding">
          <div className="sidebar-title">Green Line</div>
          <div className="sidebar-subtitle">Auto Service</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
