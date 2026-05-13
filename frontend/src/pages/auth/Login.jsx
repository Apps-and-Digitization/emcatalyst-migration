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
  const { register, handleSubmit, formState: { errors } } = useForm()

  // If already logged in, redirect to first accessible page
  if (token) {
    if (loaded && accessiblePages.length > 0) {
      const target = Object.keys(PAGE_ROUTES).find(pk => accessiblePages.includes(pk))
      return <Navigate to={target ? PAGE_ROUTES[target] : '/'} replace />
    }
    return <Navigate to="/" replace />
  }

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
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
    <div className="min-h-screen bg-gradient-to-br from-emcure-blue to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emcure-red rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">EM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EMCatalyst</h1>
          <p className="text-gray-500 text-sm mt-1">Emcure Pharmaceuticals — Event Management</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="you@emcure.com"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emcure-blue text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Emcure Pharmaceuticals Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}
