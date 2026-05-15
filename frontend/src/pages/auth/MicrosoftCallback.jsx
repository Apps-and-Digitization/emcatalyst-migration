import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../../api/endpoints'
import useAuthStore from '../../store/authStore'
import useAccessStore from '../../store/accessStore'
import api from '../../api/client'

export default function MicrosoftCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error_description') || searchParams.get('error')

    if (errorParam) {
      setError(errorParam)
      return
    }

    if (!code) {
      setError('No authorization code received from Microsoft.')
      return
    }

    // Exchange code for token
    authApi.microsoftCallback(code)
      .then(async (res) => {
        setAuth(res.data.user, res.data.access_token)
        toast.success(`Welcome, ${res.data.user.first_name || 'User'}!`)

        // Fetch access and navigate
        try {
          await api.get('/rbac/access/me')
          useAccessStore.getState().fetchAccess()
        } catch {}
        navigate('/', { replace: true })
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'Microsoft login failed'
        setError(detail)
        toast.error(detail)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-red-100">
            <span className="text-2xl">✕</span>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-neutral-900)' }}>Login Failed</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="animate-spin w-8 h-8 border-3 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
        <p className="text-sm text-gray-500">Signing in with Microsoft…</p>
      </div>
    </div>
  )
}
