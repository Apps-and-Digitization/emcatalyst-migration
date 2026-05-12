import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, FileText, Users, Building2,
  BarChart3, ShoppingCart, Megaphone, Shield, LogOut, ChevronRight, Database, ClipboardList
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import clsx from 'clsx'

const navItems = [
  { label: 'Dashboard',        path: '/',                icon: LayoutDashboard },
  { label: 'Events',           path: '/events',          icon: CalendarDays },
  { label: 'Approvals',        path: '/approvals',       icon: FileText },
  { label: 'Vendors',          path: '/vendors',         icon: Building2 },
  { label: 'Promotional',      path: '/promotional',     icon: Megaphone },
  { label: 'BRS',              path: '/brs',             icon: ClipboardList },
  { label: 'Masters',          path: '/masters',         icon: Database },
  { label: 'Reports',          path: '/reports',         icon: BarChart3 },
  { label: 'Access Mgmt',      path: '/access',          icon: Shield },
  { label: 'Users',            path: '/users',           icon: Users },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-emcure-blue flex flex-col text-white shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emcure-red rounded-lg flex items-center justify-center font-bold text-sm">EM</div>
          <div>
            <p className="font-bold text-lg leading-tight">EMCatalyst</p>
            <p className="text-blue-300 text-xs">Emcure Pharmaceuticals</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5',
                isActive
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-blue-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-emcure-red flex items-center justify-center text-xs font-bold">
            {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-blue-300 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-blue-200 hover:text-white text-sm py-1.5 px-2 rounded hover:bg-white/10 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
