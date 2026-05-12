import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { CheckCircle, ChevronDown, Send, RefreshCw, PenLine, Trash2, Clock } from 'lucide-react'
import { brsApi } from '../../api/endpoints'

/* ──────────────────────────────────────────
   Signature Canvas
────────────────────────────────────────── */
function SignatureCanvas({ onSignatureChange, disabled }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e) => {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    const pos = getPos(e, canvasRef.current)
    lastPos.current = pos
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const draw = (e) => {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
    onSignatureChange(canvas.toDataURL('image/png'))
  }

  const stop = () => { drawing.current = false }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onSignatureChange(null)
  }

  return (
    <div>
      <div className={`relative border-2 rounded-xl overflow-hidden ${disabled ? 'opacity-50' : 'border-gray-800 cursor-crosshair'}`}>
        <canvas
          ref={canvasRef}
          width={460}
          height={160}
          className="w-full bg-white block"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
          style={{ touchAction: 'none' }}
        />
        <div className="absolute bottom-2 left-3 text-xs text-gray-300 pointer-events-none select-none">
          Sign here
        </div>
      </div>
      {!disabled && (
        <button type="button" onClick={clear}
          className="mt-2 text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
          <Trash2 size={12} /> Clear signature
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   OTP Input (4 boxes)
────────────────────────────────────────── */
function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([])
  const digits = (value || '    ').split('').concat(Array(4).fill(' ')).slice(0, 4)

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = (value || '').slice(0, i) + ' ' + (value || '').slice(i + 1)
      onChange(next.trimEnd())
      if (i > 0) inputs.current[i - 1]?.focus()
      return
    }
    if (/^[0-9]$/.test(e.key)) {
      const arr = (value || '    ').split('')
      arr[i] = e.key
      onChange(arr.join('').trimEnd())
      if (i < 3) inputs.current[i + 1]?.focus()
    }
  }

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i] === ' ' ? '' : digits[i]}
          onKeyDown={e => handleKey(i, e)}
          onChange={() => {}}
          className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl
            focus:border-blue-500 focus:outline-none transition-colors
            ${disabled ? 'bg-gray-100 text-gray-400 border-gray-200'
              : 'bg-white border-gray-300 text-gray-900'}`}
        />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────
   Countdown Timer
────────────────────────────────────────── */
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) { onExpire(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  const m = Math.floor(left / 60)
  const s = left % 60
  return <span className={left <= 10 ? 'text-red-500 font-semibold' : 'text-gray-500'}>
    {m}:{s.toString().padStart(2, '0')}
  </span>
}

/* ──────────────────────────────────────────
   Video Question
────────────────────────────────────────── */
function VideoQuestion({ question, onWatched, watched }) {
  const [elapsed, setElapsed] = useState(0)
  const min = question.min_duration_seconds || 0
  const vidRef = useRef(null)

  useEffect(() => {
    let interval
    if (vidRef.current) {
      vidRef.current.addEventListener('play', () => {
        interval = setInterval(() => {
          setElapsed(e => {
            const next = e + 1
            if (next >= min && !watched) onWatched()
            return next
          })
        }, 1000)
      })
      vidRef.current.addEventListener('pause', () => clearInterval(interval))
      vidRef.current.addEventListener('ended', () => { clearInterval(interval); if (!watched) onWatched() })
    }
    return () => clearInterval(interval)
  }, [])

  const pct = min > 0 ? Math.min((elapsed / min) * 100, 100) : 100

  return (
    <div className="space-y-3">
      {question.video_url && (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={vidRef} src={question.video_url} controls className="w-full h-full" />
        </div>
      )}
      {min > 0 && (
        <div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-1000 rounded-full"
              style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {watched ? '✓ Minimum viewing time reached' : `Watch at least ${min} seconds to proceed (${elapsed}/${min}s)`}
          </p>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Main Portal
────────────────────────────────────────── */
export default function SurveyPortal() {
  const { token } = useParams()
  const [phase, setPhase] = useState('loading') // loading | hcp_form | agreement | survey | sign | completed | error
  const [portalData, setPortalData] = useState(null)

  // HCP form
  const [hcpForm, setHcpForm] = useState({ pan_number: '', bank_name: '', bank_account_no: '', ifsc_code: '' })

  // Agreement
  const [agreementScrolled, setAgreementScrolled] = useState(false)
  const agreementRef = useRef(null)

  // Survey
  const [responses, setResponses] = useState({})
  const [videoWatched, setVideoWatched] = useState({})
  const [surveyStarted, setSurveyStarted] = useState(false)

  // Signature
  const [signatureData, setSignatureData] = useState(null)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpExpired, setOtpExpired] = useState(false)
  const [devOtp, setDevOtp] = useState(null)

  const { data: rawPortal, isLoading: loadingPortal, isError: portalLoadError } = useQuery({
    queryKey: ['brs-portal', token],
    queryFn: () => brsApi.portalGet(token).then(r => r.data),
    retry: false,
  })

  useEffect(() => {
    if (rawPortal) {
      setPortalData(rawPortal)
      setHcpForm({
        pan_number: rawPortal.pan_number || '',
        bank_name: rawPortal.bank_name || '',
        bank_account_no: rawPortal.bank_account_no || '',
        ifsc_code: rawPortal.ifsc_code || '',
      })
      const s = rawPortal.status
      if (s === 'Pending HCP Form') setPhase('hcp_form')
      else if (s === 'Pending Survey') setPhase('agreement')
      else if (s === 'Pending Sign') setPhase('sign')
      else if (s === 'Survey Completed') setPhase('completed')
      else setPhase('error')
    }
  }, [rawPortal])

  useEffect(() => {
    if (portalLoadError) setPhase('error')
  }, [portalLoadError])

  const hcpFormMut = useMutation({
    mutationFn: () => brsApi.portalUpdateDetails(token, hcpForm),
    onSuccess: () => setPhase('agreement'),
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to save details'),
  })

  const startSurveyMut = useMutation({
    mutationFn: () => brsApi.portalStartSurvey(token),
    onSuccess: () => setSurveyStarted(true),
  })

  const submitSurveyMut = useMutation({
    mutationFn: () => brsApi.portalSubmitSurvey(token, { responses }),
    onSuccess: () => setPhase('sign'),
    onError: (e) => toast.error(e.response?.data?.detail || 'Submission failed'),
  })

  const sendOtpMut = useMutation({
    mutationFn: () => brsApi.portalSendOtp(token),
    onSuccess: (res) => {
      setOtpSent(true)
      setOtpExpired(false)
      setOtp('')
      if (res.data._dev_otp) {
        setDevOtp(res.data._dev_otp)
        toast.success(`OTP sent (dev mode: ${res.data._dev_otp})`)
      } else {
        toast.success('OTP sent to your registered mobile')
      }
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to send OTP'),
  })

  const signMut = useMutation({
    mutationFn: () => brsApi.portalSign(token, { otp: otp.trim(), signature_data: signatureData }),
    onSuccess: () => setPhase('completed'),
    onError: (e) => toast.error(e.response?.data?.detail || 'Invalid OTP or signature'),
  })

  const handleAgreementScroll = (e) => {
    const el = e.target
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setAgreementScrolled(true)
    }
  }

  const handleStartSurvey = () => {
    startSurveyMut.mutate()
    setPhase('survey')
  }

  const canSubmitSurvey = () => {
    if (!portalData?.survey?.questions) return true
    return portalData.survey.questions.every(q => {
      if (!q.is_required) return true
      if (q.question_type === 'video') return videoWatched[q.id]
      const r = responses[q.id]
      return r !== undefined && r !== '' && !(Array.isArray(r) && r.length === 0)
    })
  }

  if (loadingPortal || phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading survey…</p>
        </div>
      </div>
    )
  }

  if (phase === 'error' || !portalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔗</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Unavailable</h2>
          <p className="text-gray-500">This survey link is invalid, expired, or has already been used.</p>
        </div>
      </div>
    )
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-500 mb-4">
            You have successfully completed the survey and signed the agreement.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 text-left text-sm mb-6">
            <p className="text-blue-800 font-semibold">{portalData.survey_title}</p>
            <p className="text-blue-600 mt-1">
              Honorarium: ₹{portalData.honorarium_amount.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Your honorarium will be processed after verification. You will be contacted by Emcure Pharmaceuticals for payment.
          </p>
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs text-gray-400">Emcure Pharmaceuticals Ltd.</p>
          </div>
        </div>
      </div>
    )
  }

  const survey = portalData.survey
  const doctor = portalData.doctor

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#003087] text-white px-6 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-300 uppercase tracking-wide">Emcure Pharmaceuticals</p>
            <h1 className="font-bold text-lg leading-tight">Bona Fide Research Survey</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-300">BRS Code</p>
            <p className="font-mono font-bold text-sm">{portalData.brs_code}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-12">

        {/* Progress indicator */}
        <div className="flex items-center gap-2 my-5">
          {[
            { id: 'hcp_form', label: 'Your Details' },
            { id: 'agreement', label: 'Agreement' },
            { id: 'survey', label: 'Survey' },
            { id: 'sign', label: 'Sign' },
          ].map((step, i, arr) => {
            const phases = ['hcp_form', 'agreement', 'survey', 'sign', 'completed']
            const currentIdx = phases.indexOf(phase)
            const stepIdx = phases.indexOf(step.id)
            const done = currentIdx > stepIdx
            const active = phase === step.id
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${done ? 'bg-green-500 text-white'
                      : active ? 'bg-blue-600 text-white border-2 border-blue-400'
                      : 'bg-gray-200 text-gray-500'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`text-[9px] mt-1 text-center ${active ? 'text-blue-700 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Phase: HCP Form ─── */}
        {phase === 'hcp_form' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Hello, Dr. {doctor?.name || 'Doctor'}</h2>
              <p className="text-gray-500 text-sm mt-1">Please verify your details before proceeding</p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="font-semibold text-blue-800">{portalData.survey_title}</p>
              <div className="flex gap-4 mt-2 text-sm text-blue-600">
                <span>Mode: {portalData.mode}</span>
                <span>Duration: {portalData.survey_duration_minutes} min</span>
                <span>Honorarium: ₹{portalData.honorarium_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">PAN Number</label>
                <input className="input uppercase" value={hcpForm.pan_number} maxLength={10}
                  onChange={e => setHcpForm(f => ({ ...f, pan_number: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={hcpForm.bank_name}
                  onChange={e => setHcpForm(f => ({ ...f, bank_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Bank Account Number</label>
                <input className="input" value={hcpForm.bank_account_no}
                  onChange={e => setHcpForm(f => ({ ...f, bank_account_no: e.target.value }))} />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input className="input uppercase" value={hcpForm.ifsc_code}
                  onChange={e => setHcpForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))} />
              </div>
              <button className="w-full bg-[#003087] hover:bg-blue-900 text-white font-semibold py-3 rounded-xl mt-2 transition-colors"
                onClick={() => hcpFormMut.mutate()} disabled={hcpFormMut.isPending}>
                {hcpFormMut.isPending ? 'Saving…' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Phase: Agreement ─── */}
        {phase === 'agreement' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Review Agreement</h2>
            <p className="text-sm text-gray-500 mb-4">Please read the complete agreement below before proceeding.</p>
            {!agreementScrolled && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg mb-3">
                <ChevronDown size={14} className="animate-bounce" />
                Scroll to the bottom to enable the button
              </div>
            )}
            <div
              ref={agreementRef}
              onScroll={handleAgreementScroll}
              className="h-72 overflow-y-auto border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50"
            >
              {survey?.agreement_template || 'Agreement loading…'}
            </div>
            <button
              className={`w-full font-semibold py-3 rounded-xl mt-4 transition-colors
                ${agreementScrolled
                  ? 'bg-[#003087] hover:bg-blue-900 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              disabled={!agreementScrolled}
              onClick={handleStartSurvey}
            >
              I have read and agree — Start Survey →
            </button>
          </div>
        )}

        {/* ─── Phase: Survey ─── */}
        {phase === 'survey' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{survey?.title || portalData.survey_title}</h2>
                <p className="text-sm text-gray-500 mt-1">{(survey?.questions || []).length} questions</p>
              </div>
              <div className="text-right text-sm text-gray-500 flex items-center gap-1">
                <Clock size={14} /> ~{portalData.survey_duration_minutes} min
              </div>
            </div>

            <div className="space-y-6">
              {(survey?.questions || []).map((q, qi) => (
                <div key={q.id} className="border border-gray-100 rounded-xl p-5 bg-gray-50">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {q.order_no}
                    </span>
                    <p className="font-medium text-gray-800 text-sm leading-relaxed">
                      {q.question_text}
                      {q.is_required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                  </div>

                  <div className="ml-10">
                    {q.question_type === 'video' && (
                      <VideoQuestion
                        question={q}
                        watched={videoWatched[q.id]}
                        onWatched={() => setVideoWatched(w => ({ ...w, [q.id]: true }))}
                      />
                    )}
                    {q.question_type === 'free_text' && (
                      <textarea
                        className="input text-sm"
                        rows={3}
                        value={responses[q.id] || ''}
                        onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                        placeholder="Your answer…"
                      />
                    )}
                    {q.question_type === 'dropdown' && (
                      <select
                        className="input text-sm"
                        value={responses[q.id] || ''}
                        onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                      >
                        <option value="">— Select —</option>
                        {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {q.question_type === 'single_select' && (
                      <div className="space-y-2">
                        {(q.options || []).map(o => (
                          <label key={o} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                            <input type="radio" name={`q${q.id}`} value={o}
                              checked={responses[q.id] === o}
                              onChange={() => setResponses(r => ({ ...r, [q.id]: o }))}
                              className="text-blue-600" />
                            <span className="text-sm">{o}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'multi_select' && (
                      <div className="space-y-2">
                        {(q.options || []).map(o => {
                          const selected = (responses[q.id] || []).includes(o)
                          return (
                            <label key={o} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                              <input type="checkbox" checked={selected}
                                onChange={() => {
                                  const curr = responses[q.id] || []
                                  setResponses(r => ({
                                    ...r,
                                    [q.id]: selected ? curr.filter(x => x !== o) : [...curr, o]
                                  }))
                                }}
                                className="text-blue-600" />
                              <span className="text-sm">{o}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              className={`w-full font-semibold py-3 rounded-xl mt-6 transition-colors flex items-center justify-center gap-2
                ${canSubmitSurvey()
                  ? 'bg-[#003087] hover:bg-blue-900 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              disabled={!canSubmitSurvey() || submitSurveyMut.isPending}
              onClick={() => submitSurveyMut.mutate()}
            >
              <Send size={16} />
              {submitSurveyMut.isPending ? 'Submitting…' : 'Submit Survey'}
            </button>
            {!canSubmitSurvey() && (
              <p className="text-xs text-center text-gray-400 mt-2">Please answer all required questions</p>
            )}
          </div>
        )}

        {/* ─── Phase: Sign ─── */}
        {phase === 'sign' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Digital Signature</h2>
            <p className="text-sm text-gray-500 mb-6">
              Sign the agreement digitally and verify with OTP sent to your registered mobile number.
            </p>

            {/* Signature pad */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                <PenLine size={14} className="inline mr-1" />
                Draw your signature below:
              </p>
              <SignatureCanvas
                onSignatureChange={setSignatureData}
                disabled={false}
              />
            </div>

            {/* OTP Section */}
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-4">Enter OTP</p>

              {!otpSent ? (
                <button
                  className="w-full bg-[#003087] hover:bg-blue-900 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  onClick={() => sendOtpMut.mutate()}
                  disabled={sendOtpMut.isPending || !signatureData}
                >
                  <Send size={16} />
                  {sendOtpMut.isPending ? 'Sending…' : 'Send OTP to Mobile'}
                </button>
              ) : (
                <div className="space-y-4">
                  {devOtp && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-center">
                      <span className="text-yellow-700 font-medium">Dev Mode OTP: </span>
                      <span className="font-mono font-bold text-yellow-900 text-lg">{devOtp}</span>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-3">
                      OTP sent to mobile ending in {doctor?.phone?.slice(-4) || '****'}
                    </p>
                    <OtpInput value={otp} onChange={setOtp} disabled={false} />
                    {!otpExpired && otpSent && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                        <Clock size={11} /> Expires in <Countdown seconds={600} onExpire={() => setOtpExpired(true)} />
                      </p>
                    )}
                    {otpExpired && (
                      <p className="text-xs text-red-500 mt-2">OTP expired.</p>
                    )}
                  </div>

                  <button
                    className="w-full text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1"
                    onClick={() => { sendOtpMut.mutate(); setOtpExpired(false) }}
                    disabled={sendOtpMut.isPending}
                  >
                    <RefreshCw size={12} /> Resend OTP
                  </button>

                  <button
                    className={`w-full font-semibold py-3 rounded-xl transition-colors
                      ${otp.length === 4 && signatureData && !otpExpired
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    disabled={otp.length !== 4 || !signatureData || otpExpired || signMut.isPending}
                    onClick={() => signMut.mutate()}
                  >
                    {signMut.isPending ? 'Verifying…' : '✓ Submit Signature'}
                  </button>
                </div>
              )}

              {!signatureData && (
                <p className="text-xs text-center text-orange-500 mt-2">Please draw your signature above first</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>Emcure Pharmaceuticals Ltd. — Secure Survey Portal</p>
          <p className="mt-1">BRS: {portalData.brs_code}</p>
        </div>
      </div>
    </div>
  )
}
