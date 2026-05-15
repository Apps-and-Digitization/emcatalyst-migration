import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '../../api/endpoints'
import useAuthStore from '../../store/authStore'
import useAccessStore from '../../store/accessStore'
import api from '../../api/client'

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

export default function Login() {
  const navigate = useNavigate()
  const { token, setAuth } = useAuthStore()
  const { accessiblePages, loaded } = useAccessStore()
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotId, setForgotId] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  // If already logged in, redirect to first accessible page
  if (token) {
    if (loaded && accessiblePages.length > 0) {
      const target = Object.keys(PAGE_ROUTES).find(pk => accessiblePages.includes(pk))
      return <Navigate to={target ? PAGE_ROUTES[target] : '/'} replace />
    }
    return <Navigate to="/" replace />
  }

  const onSubmit = async ({ employee_id, password }) => {
    setLoading(true)
    try {
      const res = await authApi.login(employee_id, password)
      setAuth(res.data.user, res.data.access_token)
      toast.success(`Welcome, ${res.data.user.first_name || 'User'}!`)

      // Fetch access and navigate to first accessible page
      try {
        const accessRes = await api.get('/rbac/access/me')
        const pages = accessRes.data.pages || []
        useAccessStore.getState().fetchAccess()

        // Find first accessible nav page (use PAGE_ROUTES order as priority)
        let targetRoute = '/'
        for (const pageKey of Object.keys(PAGE_ROUTES)) {
          if (pages.includes(pageKey)) {
            targetRoute = PAGE_ROUTES[pageKey]
            break
          }
        }
        navigate(targetRoute)
      } catch {
        navigate('/')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-200)' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-100)' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 18 }}>EM</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-neutral-900)' }}>Catalyst</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>Emcure Pharmaceuticals — Event Management</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Employee ID</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your Employee ID"
              {...register('employee_id', { required: 'Employee ID is required' })}
            />
            {errors.employee_id && <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>{errors.employee_id.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--color-neutral-200)' }}></div>
          <span className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-neutral-200)' }}></div>
        </div>

        {/* Microsoft SSO Button */}
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await authApi.microsoftLogin()
              window.location.href = res.data.auth_url
            } catch (err) {
              toast.error(err.response?.data?.detail || 'Microsoft login not available')
            }
          }}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-full border transition-all duration-150 text-sm font-semibold"
          style={{ borderColor: 'var(--color-neutral-300)', color: 'var(--color-neutral-800)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-neutral-300)'; e.currentTarget.style.color = 'var(--color-neutral-800)' }}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Sign in with Microsoft
        </button>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-sm hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            Forgot Password?
          </button>
        </div>

        {/* Forgot Password Modal */}
        {showForgot && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowForgot(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-neutral-900)' }}>Forgot Password</h3>
              <p className="text-sm text-gray-500 mb-4">Enter your Employee ID and we'll send a reset link to your registered email.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Employee ID</label>
                  <input
                    type="text"
                    className="input"
                    value={forgotId}
                    onChange={e => setForgotId(e.target.value)}
                    placeholder="Enter your Employee ID"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button className="btn-secondary text-sm" onClick={() => setShowForgot(false)}>Cancel</button>
                <button
                  className="btn-primary text-sm"
                  disabled={forgotLoading || !forgotId.trim()}
                  onClick={async () => {
                    setForgotLoading(true)
                    try {
                      const res = await authApi.forgotPassword(forgotId.trim())
                      toast.success(res.data.message)
                      setShowForgot(false)
                      setForgotId('')
                    } catch (e) {
                      toast.error(e.response?.data?.detail || 'Something went wrong')
                    } finally {
                      setForgotLoading(false)
                    }
                  }}
                >
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-neutral-400)' }}>
          © {new Date().getFullYear()} Emcure Pharmaceuticals Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}
