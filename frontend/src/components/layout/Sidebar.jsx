import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, CalendarDays, FileText, Users, Building2,
  BarChart3, Megaphone, Shield, LogOut, Database, ClipboardList,
  GitBranch, Settings, Workflow, KeyRound
} from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useAccessStore from '../../store/accessStore'
import { authApi } from '../../api/endpoints'

const navGroups = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, pageKey: 'dashboard' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { label: 'Events', path: '/events', icon: CalendarDays, pageKey: 'events_list' },
      { label: 'Approvals', path: '/approvals', icon: FileText, pageKey: 'approvals_list' },
      { label: 'Vendors', path: '/vendors', icon: Building2, pageKey: 'vendors_list' },
      { label: 'Promotional', path: '/promotional', icon: Megaphone, pageKey: 'promotional_list' },
      { label: 'BRS', path: '/brs', icon: ClipboardList, pageKey: 'brs_list' },
    ]
  },
  {
    label: 'Data',
    items: [
      { label: 'Masters', path: '/masters', icon: Database, pageKey: 'masters' },
      { label: 'Reports', path: '/reports', icon: BarChart3, pageKey: 'reports' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { label: 'Access Mgmt', path: '/access', icon: Shield, pageKey: 'access_management' },
      { label: 'Users', path: '/users', icon: Users, pageKey: 'users' },
      { label: 'Hierarchy', path: '/hierarchy', icon: GitBranch, pageKey: 'hierarchy' },
      { label: 'RBAC Config', path: '/admin/rbac', icon: Settings, pageKey: 'admin_rbac' },
      { label: 'Workflows', path: '/admin/workflows', icon: Workflow, pageKey: 'admin_workflows' },
    ]
  },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { accessiblePages, loaded } = useAccessStore()
  const navigate = useNavigate()
  const [showChangePw, setShowChangePw] = useState(false)
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [pwLoading, setPwLoading] = useState(false)

  const handleLogout = () => {
    logout()
    useAccessStore.getState().clearAccess()
    navigate('/login', { replace: true })
  }

  const handleChangePassword = async () => {
    if (!pwForm.old_password || !pwForm.new_password) { toast.error('Fill all fields'); return }
    if (pwForm.new_password !== pwForm.confirm_password) { toast.error('Passwords do not match'); return }
    if (pwForm.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setPwLoading(true)
    try {
      await authApi.changePassword(pwForm.old_password, pwForm.new_password)
      toast.success('Password changed successfully')
      setShowChangePw(false)
      setPwForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const hasAccess = (pageKey) => {
    if (!loaded) return true
    return accessiblePages.includes(pageKey)
  }

  return (
    <aside
      className="fixed top-0 bottom-0 left-0 flex flex-col"
      style={{
        width: 'var(--sidenav-width)',
        background: '#fff',
        borderRight: '1px solid var(--color-neutral-200)',
        zIndex: 100,
      }}
    >
      {/* App Name */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 18 }}>Catalyst</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>Emcure Pharmaceuticals</p>
      </div>

      {/* Nav — scrollable inner */}
      <nav className="flex-1 overflow-y-auto overflow-x-visible py-4 px-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(i => hasAccess(i.pageKey))
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label} className="mb-4">
              <p
                className="px-3 mb-2"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.1em',
                  color: 'var(--color-neutral-500)',
                }}
              >
                {group.label}
              </p>
              {visibleItems.map(({ label, path, icon: Icon, pageKey }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-all duration-150 ${
                      isActive
                        ? 'text-white'
                        : 'hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)]'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { color: 'var(--color-neutral-600)' }
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid var(--color-neutral-200)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center text-white font-bold"
            style={{
              width: 32, height: 32,
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
            }}
          >
            {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-neutral-900)' }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--color-neutral-500)' }}>
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowChangePw(true)}
          className="w-full flex items-center gap-2 text-[13px] py-1.5 px-2 rounded-lg transition-all duration-150 mb-1"
          style={{ color: 'var(--color-neutral-600)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-50)'; e.currentTarget.style.color = 'var(--color-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-neutral-600)' }}
        >
          <KeyRound size={15} />
          Change Password
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-[13px] py-1.5 px-2 rounded-lg transition-all duration-150"
          style={{ color: 'var(--color-neutral-600)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-50)'; e.currentTarget.style.color = 'var(--color-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-neutral-600)' }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowChangePw(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-neutral-900)' }}>Change Password</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Current Password</label>
                <input type="password" className="input" value={pwForm.old_password}
                  onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))}
                  placeholder="Enter current password" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">New Password</label>
                <input type="password" className="input" value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Min 8 chars, uppercase, lowercase, digit" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Confirm New Password</label>
                <input type="password" className="input" value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="Re-enter new password" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button className="btn-secondary text-sm" onClick={() => setShowChangePw(false)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={handleChangePassword} disabled={pwLoading}>
                {pwLoading ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
