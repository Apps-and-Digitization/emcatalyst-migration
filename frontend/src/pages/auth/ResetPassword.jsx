import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../../api/endpoints'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-neutral-900)' }}>Invalid Link</h2>
          <p className="text-sm text-gray-500 mb-4">This password reset link is invalid or has expired.</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await authApi.resetPassword(token, password)
      toast.success(res.data.message)
      setSuccess(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-emerald-100">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-neutral-900)' }}>Password Reset</h2>
          <p className="text-sm text-gray-500 mb-6">Your password has been reset successfully. You can now login with your new password.</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-neutral-100)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md p-8" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-200)' }}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-100)' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 18 }}>EM</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-neutral-900)' }}>Reset Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              placeholder="Min 8 chars, uppercase, lowercase, digit"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input
              type="password"
              className="input"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button onClick={() => navigate('/login')} className="text-sm hover:underline" style={{ color: 'var(--color-primary)' }}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
