import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore'

import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import Dashboard from './pages/Dashboard'
import EventList from './pages/events/EventList'
import EventForm from './pages/events/EventForm'
import EventDetail from './pages/events/EventDetail'
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
import BrsBulkList from './pages/brs/BrsBulkList'
import BrsBulkForm from './pages/brs/BrsBulkForm'
import BrsBulkDetail from './pages/brs/BrsBulkDetail'
import SurveyBuilder from './pages/brs/SurveyBuilder'
import SurveyPortal from './pages/brs/SurveyPortal'
import DoctorPortalLogin from './pages/brs/DoctorPortalLogin'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function PrivateRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<EventList />} />
              <Route path="events/new" element={<EventForm />} />
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="approvals" element={<InvoiceList />} />
              <Route path="approvals/new" element={<InvoiceForm />} />
              <Route path="approvals/:id" element={<InvoiceDetail />} />
              <Route path="agreements" element={<AgreementList />} />
              <Route path="agreements/new" element={<AgreementForm />} />
              <Route path="vendors" element={<VendorList />} />
              <Route path="vendors/new" element={<VendorList />} />
              <Route path="reports" element={<Reports />} />
              <Route path="access" element={<AccessManagement />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="hierarchy" element={<HierarchyView />} />
              <Route path="promotional" element={<PromotionalList />} />
              <Route path="promotional/new" element={<PromotionalForm />} />
              <Route path="masters" element={<Masters />} />
              <Route path="brs" element={<BrsList />} />
              <Route path="brs/new" element={<BrsForm />} />
              <Route path="brs/survey-builder" element={<SurveyBuilder />} />
              <Route path="brs/bulk" element={<BrsBulkList />} />
              <Route path="brs/bulk/new" element={<BrsBulkForm />} />
              <Route path="brs/bulk/:id" element={<BrsBulkDetail />} />
              <Route path="brs/:id" element={<BrsDetail />} />
            </Route>
            {/* Public doctor portal — no auth required */}
            <Route path="/brs/survey/:token" element={<SurveyPortal />} />
            <Route path="/doctor-portal" element={<DoctorPortalLogin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
