import { useNavigate } from 'react-router-dom'
import { Shield, LogOut } from 'lucide-react'
import useAccessStore from '../store/accessStore'
import useAuthStore from '../store/authStore'

// Map page_keys to their routes
const PAGE_ROUTES = {
  dashboard: '/',
  events_list: '/events',
  approvals_list: '/approvals',
  vendors_list: '/vendors',
  promotional_list: '/promotional',
  brs_list: '/brs',
  masters: '/masters',
  reports: '/reports',
  access_management: '/access',
  users: '/users',
  hierarchy: '/hierarchy',
  agreements_list: '/agreements',
  admin_rbac: '/admin/rbac',
  admin_workflows: '/admin/workflows',
  brs_bulk_upload: '/brs/bulk-upload',
}

export default function Unauthorized() {
  const navigate = useNavigate()
  const { accessiblePages } = useAccessStore()
  const { logout } = useAuthStore()

  const handleGoHome = () => {
    // Navigate to first accessible page (use PAGE_ROUTES order as priority)
    for (const pageKey of Object.keys(PAGE_ROUTES)) {
      if (accessiblePages.includes(pageKey)) {
        navigate(PAGE_ROUTES[pageKey])
        return
      }
    }
    navigate('/')
  }

  const handleLogout = () => {
    logout()
    useAccessStore.getState().clearAccess()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <Shield className="w-8 h-8 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-6 max-w-md">
        You don't have permission to access this page. Contact your administrator if you believe this is an error.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleGoHome}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Home
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
