import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast as hotToast } from 'react-hot-toast'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useAccessStore from './store/accessStore'

import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/auth/Login'
import ResetPassword from './pages/auth/ResetPassword'
import MicrosoftCallback from './pages/auth/MicrosoftCallback'
import EventList from './pages/events/EventList'
import EventForm from './pages/events/EventForm'
import EventDetail from './pages/events/EventDetail'
import PostEventDocuments from './pages/events/PostEventDocuments'
import EventAgreements from './pages/events/EventAgreements'

import UserManagement from './pages/users/UserManagement'
import HierarchyView from './pages/users/HierarchyView'

import Masters from './pages/masters/Masters'
import MasterEntities from './pages/masters/MasterEntities'
import MasterDivisions from './pages/masters/MasterDivisions'
import MasterDoctors from './pages/masters/MasterDoctors'
import MasterBrands from './pages/masters/MasterBrands'
import MasterTherapeutics from './pages/masters/MasterTherapeutics'
import MasterDocumentTypes from './pages/masters/MasterDocumentTypes'
import MasterMeals from './pages/masters/MasterMeals'
import MasterFmvParameters from './pages/masters/MasterFmvParameters'
import MasterBudget from './pages/masters/MasterBudget'
import MasterTerritories from './pages/masters/MasterTerritories'
import EventReport from './pages/reports/EventReport'
import CmeEventReport from './pages/reports/CmeEventReport'
import FmvParameterReport from './pages/reports/FmvParameterReport'
import SurveyAnalyticsReport from './pages/reports/SurveyAnalyticsReport'
import VendorList from './pages/vendor/VendorList'
import VendorOrderNumbers from './pages/vendor/VendorOrderNumbers'
import VendorTypeOfServices from './pages/vendor/VendorTypeOfServices'
import VendorGLAccounts from './pages/vendor/VendorGLAccounts'
import VendorWithholdingTax from './pages/vendor/VendorWithholdingTax'
import VendorWithholdingTaxView from './pages/vendor/VendorWithholdingTaxView'
import VendorHsnSacCodes from './pages/vendor/VendorHsnSacCodes'
import VendorBusinessPlaces from './pages/vendor/VendorBusinessPlaces'
import VendorBusinessAreas from './pages/vendor/VendorBusinessAreas'
import VendorTaxCodes from './pages/vendor/VendorTaxCodes'
import BrsList from './pages/brs/BrsList'
import BrsForm from './pages/brs/BrsForm'
import BrsDetail from './pages/brs/BrsDetail'
import BrsBulkUpload from './pages/brs/BrsBulkUpload'
import BrsBudget from './pages/budget/BrsBudget'
import SurveyBuilder from './pages/brs/SurveyBuilder'
import SurveyPortal from './pages/brs/SurveyPortal'
import DoctorLogin from './pages/brs/DoctorLogin'
import RBACConfig from './pages/admin/RBACConfig'
import WorkflowConfig from './pages/admin/WorkflowConfig'
import Unauthorized from './pages/Unauthorized'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function PrivateRoute({ children }) {
  const { token } = useAuthStore()

  useEffect(() => {
    // Handle browser back/forward cache (bfcache)
    const handlePageShow = (e) => {
      if (e.persisted && !localStorage.getItem('token')) {
        window.location.href = '/login'
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  return token ? children : <Navigate to="/login" replace />
}

function AccessLoader({ children }) {
  const { token } = useAuthStore()
  const { fetchAccess, loaded } = useAccessStore()

  useEffect(() => {
    if (token) {
      fetchAccess()
    }
  }, [token, fetchAccess])

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            error: { duration: 6000 },
          }}
        >
          {(t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              style={{ maxWidth: '360px', ...(t.type === 'error' ? { background: '#FEF2F2', border: '1px solid #FECACA' } : {}) }}
            >
              <div className="p-3 flex-1 min-w-0">
                <p className={`text-sm font-medium break-words whitespace-pre-wrap ${t.type === 'error' ? 'text-red-800' : t.type === 'success' ? 'text-green-800' : 'text-gray-900'}`}>
                  {typeof t.message === 'function' ? t.message(t) : t.message}
                </p>
              </div>
              {t.type === 'error' && (
                <button
                  onClick={() => hotToast.dismiss(t.id)}
                  className="px-3 flex items-center border-l border-red-200 text-red-500 hover:text-red-700 text-lg font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </Toaster>
        <ErrorBoundary>
          <AccessLoader>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/microsoft/callback" element={<MicrosoftCallback />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Navigate to="/events" replace />} />
                <Route path="events" element={<ProtectedRoute pageKey="events_list"><EventList /></ProtectedRoute>} />
                <Route path="events/new" element={<ProtectedRoute pageKey="events_create"><EventForm /></ProtectedRoute>} />
                <Route path="events/:id/edit" element={<ProtectedRoute pageKey="events_edit"><EventForm /></ProtectedRoute>} />
                <Route path="events/:id" element={<ProtectedRoute pageKey="events_detail"><EventDetail /></ProtectedRoute>} />
                <Route path="events/:id/post-documents" element={<ProtectedRoute pageKey="events_post_docs"><PostEventDocuments /></ProtectedRoute>} />
                <Route path="events/:id/agreements" element={<ProtectedRoute pageKey="events_detail"><EventAgreements /></ProtectedRoute>} />


                <Route path="users" element={<ProtectedRoute pageKey="users"><UserManagement /></ProtectedRoute>} />
                <Route path="hierarchy" element={<ProtectedRoute pageKey="hierarchy"><HierarchyView /></ProtectedRoute>} />

                <Route path="masters" element={<ProtectedRoute pageKey="masters"><Masters /></ProtectedRoute>} />
                <Route path="masters/entities" element={<ProtectedRoute pageKey="masters_entities"><MasterEntities /></ProtectedRoute>} />
                <Route path="masters/divisions" element={<ProtectedRoute pageKey="masters_divisions"><MasterDivisions /></ProtectedRoute>} />
                <Route path="masters/doctors" element={<ProtectedRoute pageKey="masters_doctors"><MasterDoctors /></ProtectedRoute>} />
                <Route path="masters/brands" element={<ProtectedRoute pageKey="masters_brands"><MasterBrands /></ProtectedRoute>} />
                <Route path="masters/therapeutics" element={<ProtectedRoute pageKey="masters_therapeutics"><MasterTherapeutics /></ProtectedRoute>} />
                <Route path="masters/document-types" element={<ProtectedRoute pageKey="masters_document_types"><MasterDocumentTypes /></ProtectedRoute>} />
                <Route path="masters/meals" element={<ProtectedRoute pageKey="masters_meals"><MasterMeals /></ProtectedRoute>} />
                <Route path="masters/fmv-parameters" element={<ProtectedRoute pageKey="masters_fmv_parameters"><MasterFmvParameters /></ProtectedRoute>} />
                <Route path="masters/budget" element={<ProtectedRoute pageKey="masters_budget"><MasterBudget /></ProtectedRoute>} />
                <Route path="masters/territories" element={<ProtectedRoute pageKey="masters_territories"><MasterTerritories /></ProtectedRoute>} />
                <Route path="budget/events" element={<ProtectedRoute pageKey="budget_events"><MasterBudget /></ProtectedRoute>} />
                <Route path="budget/brs" element={<ProtectedRoute pageKey="budget_brs"><BrsBudget /></ProtectedRoute>} />
                <Route path="reports/events" element={<ProtectedRoute pageKey="reports_events"><EventReport /></ProtectedRoute>} />
                <Route path="reports/cme-events" element={<ProtectedRoute pageKey="reports_cme_events"><CmeEventReport /></ProtectedRoute>} />
                <Route path="reports/fmv-parameters" element={<ProtectedRoute pageKey="reports_fmv_parameters"><FmvParameterReport /></ProtectedRoute>} />
                <Route path="reports/survey-analytics" element={<ProtectedRoute pageKey="reports_survey_analytics"><SurveyAnalyticsReport /></ProtectedRoute>} />
                <Route path="vendor/vendors" element={<ProtectedRoute pageKey="vendor_vendors"><VendorList /></ProtectedRoute>} />
                <Route path="vendor/order-numbers" element={<ProtectedRoute pageKey="vendor_order_numbers"><VendorOrderNumbers /></ProtectedRoute>} />
                <Route path="vendor/type-of-services" element={<ProtectedRoute pageKey="vendor_type_of_services"><VendorTypeOfServices /></ProtectedRoute>} />
                <Route path="vendor/gl-accounts" element={<ProtectedRoute pageKey="vendor_gl_accounts"><VendorGLAccounts /></ProtectedRoute>} />
                <Route path="vendor/withholding-tax" element={<ProtectedRoute pageKey="vendor_withholding_tax"><VendorWithholdingTax /></ProtectedRoute>} />
                <Route path="vendor/vendor-wht" element={<ProtectedRoute pageKey="vendor_vendor_wht"><VendorWithholdingTaxView /></ProtectedRoute>} />
                <Route path="vendor/hsn-sac-codes" element={<ProtectedRoute pageKey="vendor_hsn_sac_codes"><VendorHsnSacCodes /></ProtectedRoute>} />
                <Route path="vendor/business-places" element={<ProtectedRoute pageKey="vendor_business_places"><VendorBusinessPlaces /></ProtectedRoute>} />
                <Route path="vendor/business-areas" element={<ProtectedRoute pageKey="vendor_business_areas"><VendorBusinessAreas /></ProtectedRoute>} />
                <Route path="vendor/tax-codes" element={<ProtectedRoute pageKey="vendor_tax_codes"><VendorTaxCodes /></ProtectedRoute>} />
                <Route path="vendor/hsn-sac-codes" element={<ProtectedRoute pageKey="vendor_hsn_sac_codes"><VendorHsnSacCodes /></ProtectedRoute>} />
                <Route path="brs" element={<ProtectedRoute pageKey="brs_list"><BrsList /></ProtectedRoute>} />
                <Route path="brs/new" element={<ProtectedRoute pageKey="brs_create"><BrsForm /></ProtectedRoute>} />
                <Route path="brs/bulk-upload" element={<ProtectedRoute pageKey="brs_bulk_upload"><BrsBulkUpload /></ProtectedRoute>} />
                <Route path="brs/:id/edit" element={<ProtectedRoute pageKey="brs_edit"><BrsForm /></ProtectedRoute>} />
                <Route path="brs/survey-builder" element={<ProtectedRoute pageKey="brs_survey_builder"><SurveyBuilder /></ProtectedRoute>} />
                <Route path="brs/:id" element={<ProtectedRoute pageKey="brs_detail"><BrsDetail /></ProtectedRoute>} />
                <Route path="admin/rbac" element={<ProtectedRoute pageKey="admin_rbac"><RBACConfig /></ProtectedRoute>} />
                <Route path="admin/workflows" element={<ProtectedRoute pageKey="admin_workflows"><WorkflowConfig /></ProtectedRoute>} />
              </Route>
              {/* Public doctor portal — no auth required */}
              <Route path="/brs/survey/:token" element={<SurveyPortal />} />
              <Route path="/brs/doctor-login" element={<DoctorLogin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AccessLoader>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
