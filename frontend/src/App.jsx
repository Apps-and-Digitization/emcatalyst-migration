import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useAccessStore from './store/accessStore'

import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/auth/Login'
import Dashboard from './pages/Dashboard'
import EventList from './pages/events/EventList'
import EventForm from './pages/events/EventForm'
import EventDetail from './pages/events/EventDetail'
import PostEventDocuments from './pages/events/PostEventDocuments'
import InvoiceList from './pages/approvals/InvoiceList'
import InvoiceForm from './pages/approvals/InvoiceForm'
import InvoiceDetail from './pages/approvals/InvoiceDetail'
import VendorList from './pages/vendors/VendorList'
import AgreementList from './pages/agreements/AgreementList'
import AgreementForm from './pages/agreements/AgreementForm'
import Reports from './pages/reports/Reports'
import AccessManagement from './pages/access/AccessManagement'
import UserManagement from './pages/users/UserManagement'
import HierarchyView from './pages/users/HierarchyView'
import PromotionalList from './pages/promotional/PromotionalList'
import PromotionalForm from './pages/promotional/PromotionalForm'
import Masters from './pages/masters/Masters'
import BrsList from './pages/brs/BrsList'
import BrsForm from './pages/brs/BrsForm'
import BrsDetail from './pages/brs/BrsDetail'
import BrsBulkUpload from './pages/brs/BrsBulkUpload'
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
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <ErrorBoundary>
          <AccessLoader>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<ProtectedRoute pageKey="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="events" element={<ProtectedRoute pageKey="events_list"><EventList /></ProtectedRoute>} />
                <Route path="events/new" element={<ProtectedRoute pageKey="events_create"><EventForm /></ProtectedRoute>} />
                <Route path="events/:id/edit" element={<ProtectedRoute pageKey="events_edit"><EventForm /></ProtectedRoute>} />
                <Route path="events/:id" element={<ProtectedRoute pageKey="events_detail"><EventDetail /></ProtectedRoute>} />
                <Route path="events/:id/post-documents" element={<ProtectedRoute pageKey="events_post_docs"><PostEventDocuments /></ProtectedRoute>} />
                <Route path="approvals" element={<ProtectedRoute pageKey="approvals_list"><InvoiceList /></ProtectedRoute>} />
                <Route path="approvals/new" element={<ProtectedRoute pageKey="approvals_create"><InvoiceForm /></ProtectedRoute>} />
                <Route path="approvals/:id" element={<ProtectedRoute pageKey="approvals_detail"><InvoiceDetail /></ProtectedRoute>} />
                <Route path="agreements" element={<ProtectedRoute pageKey="agreements_list"><AgreementList /></ProtectedRoute>} />
                <Route path="agreements/new" element={<ProtectedRoute pageKey="agreements_create"><AgreementForm /></ProtectedRoute>} />
                <Route path="vendors" element={<ProtectedRoute pageKey="vendors_list"><VendorList /></ProtectedRoute>} />
                <Route path="vendors/new" element={<ProtectedRoute pageKey="vendors_list"><VendorList /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute pageKey="reports"><Reports /></ProtectedRoute>} />
                <Route path="access" element={<ProtectedRoute pageKey="access_management"><AccessManagement /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute pageKey="users"><UserManagement /></ProtectedRoute>} />
                <Route path="hierarchy" element={<ProtectedRoute pageKey="hierarchy"><HierarchyView /></ProtectedRoute>} />
                <Route path="promotional" element={<ProtectedRoute pageKey="promotional_list"><PromotionalList /></ProtectedRoute>} />
                <Route path="promotional/new" element={<ProtectedRoute pageKey="promotional_create"><PromotionalForm /></ProtectedRoute>} />
                <Route path="masters" element={<ProtectedRoute pageKey="masters"><Masters /></ProtectedRoute>} />
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
