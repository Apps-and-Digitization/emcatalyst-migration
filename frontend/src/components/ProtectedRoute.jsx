import { Navigate } from 'react-router-dom'
import useAccessStore from '../store/accessStore'

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

/**
 * Route guard that checks RBAC page access.
 * Wrap existing route elements with this component.
 */
export default function ProtectedRoute({ pageKey, children }) {
  const { accessiblePages, loaded, error } = useAccessStore()

  // While access is loading or errored, render children (don't block)
  if (!loaded || error) return children

  if (!accessiblePages.includes(pageKey)) {
    // Find the first accessible page to redirect to (use PAGE_ROUTES order as priority)
    for (const pk of Object.keys(PAGE_ROUTES)) {
      if (accessiblePages.includes(pk)) {
        return <Navigate to={PAGE_ROUTES[pk]} replace />
      }
    }
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
