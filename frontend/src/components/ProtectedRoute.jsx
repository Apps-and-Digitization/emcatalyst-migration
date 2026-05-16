import { Navigate } from 'react-router-dom'
import useAccessStore from '../store/accessStore'
import LoadingSpinner from './ui/LoadingSpinner'

const PAGE_ROUTES = {
  dashboard: '/',
  events_list: '/events',
  brs_list: '/brs',
  masters: '/masters',
  masters_entities: '/masters/entities',
  masters_divisions: '/masters/divisions',
  masters_doctors: '/masters/doctors',
  masters_brands: '/masters/brands',
  masters_therapeutics: '/masters/therapeutics',
  masters_document_types: '/masters/document-types',
  masters_meals: '/masters/meals',
  masters_fmv_parameters: '/masters/fmv-parameters',
  masters_budget: '/masters/budget',
  reports_events: '/reports/events',
  reports_cme_events: '/reports/cme-events',
  reports_fmv_parameters: '/reports/fmv-parameters',
  vendor_vendors: '/vendor/vendors',
  vendor_order_numbers: '/vendor/order-numbers',
  vendor_type_of_services: '/vendor/type-of-services',
  vendor_gl_accounts: '/vendor/gl-accounts',
  vendor_withholding_tax: '/vendor/withholding-tax',
  vendor_hsn_sac_codes: '/vendor/hsn-sac-codes',
  vendor_business_places: '/vendor/business-places',
  vendor_business_areas: '/vendor/business-areas',
  vendor_tax_codes: '/vendor/tax-codes',
  vendor_hsn_sac_codes: '/vendor/hsn-sac-codes',
  users: '/users',
  hierarchy: '/hierarchy',
  admin_rbac: '/admin/rbac',
  admin_workflows: '/admin/workflows',
  brs_bulk_upload: '/brs/bulk-upload',
}

/**
 * Route guard that checks RBAC page access.
 * Wrap existing route elements with this component.
 */
export default function ProtectedRoute({ pageKey, children }) {
  const { accessiblePages, loaded, loading, error } = useAccessStore()

  // Show loading spinner while RBAC is being fetched
  if (!loaded && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  // On error, redirect to a limited-access state
  if (error && pageKey !== 'dashboard') {
    return <Navigate to="/" replace />
  }

  // If loaded but user doesn't have access
  if (loaded && !accessiblePages.includes(pageKey)) {
    for (const pk of Object.keys(PAGE_ROUTES)) {
      if (accessiblePages.includes(pk)) {
        return <Navigate to={PAGE_ROUTES[pk]} replace />
      }
    }
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
