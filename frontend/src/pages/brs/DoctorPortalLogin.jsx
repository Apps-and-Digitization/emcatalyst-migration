import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Mail, Key, User, CheckCircle, ClipboardList, ArrowRight, Save } from 'lucide-react'
import { brsApi } from '../../api/endpoints'

// Step indicators
const STEPS = ['Login', 'Profile', 'Surveys']

function StepDot({ step, current }) {
  const done = step < current
  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2
      ${done ? 'bg-blue-600 border-blue-600 text-white'
        : step === current ? 'border-blue-600 text-blue-600 bg-white'
        : 'border-gray-300 text-gray-400 bg-white'}`}>
      {done ? <CheckCircle size={16} /> : step + 1}
    </div>
  )
}

export default function DoctorPortalLogin() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0) // 0=email, 1=otp, 2=profile+surveys
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [profile, setProfile] = useState(null)
  const [editKyc, setEditKyc] = useState(false)

  const [kyc, setKyc] = useState({
    pan_number: '', bank_name: '', account_number: '', ifsc_code: '', name_as_per_bank: '',
    mobile_number: '', address: '', city: '', state: '',
  })

  const sendOtpMutation = useMutation({
    mutationFn: (em) => brsApi.doctorPortalSendOtp(em),
    onSuccess: (res) => {
      toast.success('OTP sent to your registered mobile / email')
      setDevOtp(res.data._dev_otp || '')
      setStep(1)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to send OTP'),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: () => brsApi.doctorPortalVerifyOtp(email, otp),
    onSuccess: (res) => {
      const token = res.data.session_token
      setSessionToken(token)
      // Fetch profile
      brsApi.doctorPortalProfile(token).then(r => {
        const p = r.data
        setProfile(p)
        setKyc({
          pan_number: p.pan_number || '',
          bank_name: p.bank_name || '',
          account_number: p.account_number || '',
          ifsc_code: p.ifsc_code || '',
          name_as_per_bank: p.name_as_per_bank || '',
          mobile_number: p.mobile_number || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
        })
        setStep(2)
      }).catch(() => { toast.error('Could not load profile'); setStep(2) })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Invalid OTP'),
  })

  const saveProfileMutation = useMutation({
    mutationFn: (data) => brsApi.doctorPortalUpdateProfile(sessionToken, data),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      setEditKyc(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Update failed'),
  })

  const setK = (k, v) => setKyc(prev => ({ ...prev, [k]: v }))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center font-bold text-white text-sm">EM</div>
          <div>
            <p className="font-bold text-blue-900 leading-tight">EMCatalyst</p>
            <p className="text-xs text-gray-500">Doctor Portal — Emcure Pharmaceuticals</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center pt-12 px-4">
        <div className="w-full max-w-xl">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <StepDot step={i} current={step} />
                <span className={`text-sm ${i === step ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-300 ml-2" />}
              </div>
            ))}
          </div>

          {/* Step 0: Email */}
          {step === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Mail size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Welcome, Doctor</h2>
                  <p className="text-sm text-gray-500">Enter your registered email to receive an OTP</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" placeholder="your.email@hospital.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && email && sendOtpMutation.mutate(email)} />
                </div>
                <button className="btn-primary w-full flex items-center justify-center gap-2"
                  disabled={!email || sendOtpMutation.isPending}
                  onClick={() => sendOtpMutation.mutate(email)}>
                  {sendOtpMutation.isPending ? 'Sending…' : <><span>Send OTP</span><ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 1: OTP */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Key size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
                  <p className="text-sm text-gray-500">Sent to <strong>{email}</strong></p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">One-Time Password</label>
                  <input className="input text-2xl tracking-[0.5em] font-mono text-center" type="text"
                    maxLength={6} placeholder="• • • • • •"
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && otp.length >= 4 && verifyOtpMutation.mutate()} />
                </div>
                {devOtp && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    <strong>[Dev mode]</strong> OTP: <strong className="font-mono text-base">{devOtp}</strong>
                  </div>
                )}
                <button className="btn-primary w-full flex items-center justify-center gap-2"
                  disabled={otp.length < 4 || verifyOtpMutation.isPending}
                  onClick={() => verifyOtpMutation.mutate()}>
                  {verifyOtpMutation.isPending ? 'Verifying…' : <><span>Verify OTP</span><ArrowRight size={16} /></>}
                </button>
                <button className="text-sm text-blue-600 underline w-full text-center"
                  onClick={() => { setStep(0); setOtp('') }}>
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Profile + Surveys */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Profile card */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{profile?.full_name || email}</h3>
                      <p className="text-xs text-gray-500">{profile?.qualification || profile?.doctor_type || 'Doctor'} • {profile?.city || '—'}</p>
                    </div>
                  </div>
                  {profile?.found && (
                    <button className="btn-secondary text-xs py-1 px-3"
                      onClick={() => setEditKyc(v => !v)}>
                      {editKyc ? 'Cancel' : 'Edit KYC / Bank'}
                    </button>
                  )}
                </div>

                {profile?.found && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <div><p className="text-xs text-gray-400">Mobile</p><p className="font-medium">{profile.mobile_number || '—'}</p></div>
                      <div><p className="text-xs text-gray-400">MCI Reg. No</p><p className="font-medium">{profile.mci_reg_number || '—'}</p></div>
                      <div><p className="text-xs text-gray-400">State</p><p className="font-medium">{profile.state || '—'}</p></div>
                      <div><p className="text-xs text-gray-400">GST Registered</p><p className="font-medium">{profile.is_registered_under_gst ? 'Yes' : 'No'}</p></div>
                    </div>

                    {/* KYC section */}
                    {!editKyc ? (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">KYC & Banking Details</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><p className="text-xs text-gray-400">PAN Number</p><p className="font-mono font-medium">{kyc.pan_number || <span className="text-amber-500 text-xs">Not filled</span>}</p></div>
                          <div><p className="text-xs text-gray-400">Bank Name</p><p className="font-medium">{kyc.bank_name || <span className="text-amber-500 text-xs">Not filled</span>}</p></div>
                          <div><p className="text-xs text-gray-400">Account Number</p><p className="font-mono font-medium">{kyc.account_number || <span className="text-amber-500 text-xs">Not filled</span>}</p></div>
                          <div><p className="text-xs text-gray-400">IFSC Code</p><p className="font-mono font-medium">{kyc.ifsc_code || <span className="text-amber-500 text-xs">Not filled</span>}</p></div>
                          <div><p className="text-xs text-gray-400">Name as per Bank</p><p className="font-medium">{kyc.name_as_per_bank || <span className="text-amber-500 text-xs">Not filled</span>}</p></div>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Edit KYC & Bank Details</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { k: 'pan_number', label: 'PAN Number', upper: true },
                            { k: 'bank_name', label: 'Bank Name' },
                            { k: 'account_number', label: 'Account Number' },
                            { k: 'ifsc_code', label: 'IFSC Code', upper: true },
                            { k: 'name_as_per_bank', label: 'Name as per Bank' },
                            { k: 'mobile_number', label: 'Mobile Number' },
                            { k: 'city', label: 'City' },
                            { k: 'state', label: 'State' },
                          ].map(f => (
                            <div key={f.k}>
                              <label className="label text-xs">{f.label}</label>
                              <input className="input text-sm"
                                value={kyc[f.k]}
                                onChange={e => setK(f.k, f.upper ? e.target.value.toUpperCase() : e.target.value)} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="label text-xs">Address</label>
                            <textarea className="input text-sm" rows={2} value={kyc.address}
                              onChange={e => setK('address', e.target.value)} />
                          </div>
                        </div>
                        <button className="btn-primary flex items-center gap-2 text-sm"
                          disabled={saveProfileMutation.isPending}
                          onClick={() => saveProfileMutation.mutate(kyc)}>
                          <Save size={14} />
                          {saveProfileMutation.isPending ? 'Saving…' : 'Save Profile'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!profile?.found && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                    Your email is not found in our MCL database. Please contact your Emcure representative.
                  </p>
                )}
              </div>

              {/* Pending Surveys */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={18} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Pending Surveys</h3>
                  <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {profile?.pending_surveys?.length || 0}
                  </span>
                </div>

                {!profile?.pending_surveys?.length ? (
                  <p className="text-sm text-gray-400 text-center py-6">No pending surveys at this time.</p>
                ) : (
                  <div className="space-y-3">
                    {profile.pending_surveys.map(s => (
                      <div key={s.brs_code}
                        className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-blue-300 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{s.survey_title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {s.brs_code} &bull; Status: <strong>{s.status}</strong>
                            {s.deadline_at && <> &bull; Deadline: {new Date(s.deadline_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>}
                          </p>
                        </div>
                        {s.token ? (
                          <button
                            className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
                            onClick={() => navigate(`/brs/survey/${s.token}`)}>
                            Open <ArrowRight size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Link not yet sent</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
