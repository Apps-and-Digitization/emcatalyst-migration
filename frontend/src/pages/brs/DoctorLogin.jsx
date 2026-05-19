import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { brsApi } from '../../api/endpoints'

export default function DoctorLogin() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginId || !password) { toast.error('Enter login ID and password'); return }
    setLoading(true)
    try {
      const res = await brsApi.doctorLogin(loginId, password)
      const { token } = res.data
      navigate(`/brs/survey/${token}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-neutral-50)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-200)' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-100)' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 18 }}>EM</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-neutral-900)' }}>Doctor Portal</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>BRS Survey — Login with credentials received via email</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="label">Login ID</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. brs_brs202506_1"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-neutral-400)' }}>
          © Emcure Pharmaceuticals Ltd. — EMCatalyst
        </p>
      </div>
    </div>
  )
}
