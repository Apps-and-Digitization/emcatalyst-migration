import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { brsApi } from '../../api/endpoints'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { CheckCircle, Edit2, FileSignature, ClipboardList } from 'lucide-react'

// Signature Pad Component
function SignaturePad({ onSave }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    setDrawing(true)
    setHasDrawn(true)
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDraw = () => setDrawing(false)

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const save = () => {
    if (!hasDrawn) { toast.error('Please draw your signature'); return }
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Draw your signature below:</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary text-sm" onClick={clear}>Clear</button>
        <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-sm" onClick={save}>✓ Confirm Signature</button>
      </div>
    </div>
  )
}

// Agreement Template
function AgreementDocument({ doctor, brs, survey }) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return (
    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
      <h2 className="text-center text-lg font-bold mb-1">EXPERT SERVICES AGREEMENT (Survey)</h2>
      <p className="text-center text-sm text-gray-500 mb-6">BRS ID: {brs.brs_code} / Date: {today}</p>

      <p>To,<br/>
      <strong>Dr. {doctor.doctor_name}</strong>,<br/>
      {doctor.speciality && <>{doctor.speciality}<br/></>}
      </p>

      <p><strong>Usage of:</strong> {survey?.title || '—'}<br/>
      <strong>Field of:</strong> {brs.title || survey?.title || '—'}<br/>
      <strong>Amount:</strong> ₹{Number(doctor.honorarium_amount || 0).toLocaleString('en-IN')}/-</p>

      <ol className="list-decimal pl-5 space-y-3 text-sm">
        <li>We wish to seek your expert advice on usage of the above mentioned subject and its combination in different age group of patients and in furtherance to our discussion in this regard, we are pleased to appoint you as an Expert representing Emcure Pharmaceuticals Limited (hereinafter referred to as 'Emcure / Company').</li>

        <li>You are requested to perform the following activities as an 'Expert' (hereinafter referred to as 'purpose'):
          <br/><em>i. Advise and update the Company on developments and issues in the field mentioned above, in form of written opinions or expert survey reports.</em>
        </li>

        <li>Emcure reserves the right to publish any lecture/talk given by you in such scientific congresses/conferences/meetings/seminars in any medical journals. The 'period' for your services shall begin on the date you sign this Agreement and shall continue for a period of one (1) year or such earlier period as the Company may deem appropriate.</li>

        <li>In exchange for you acting as our Expert in accordance with this Agreement, Emcure will pay you by cheque or e-transfer (in your name only) into your nominated account a onetime service fee of <strong>INR {Number(doctor.honorarium_amount || 0).toLocaleString('en-IN')}/-</strong> for rendering expert services to the Company. Emcure will make such payment subject to necessary statutory deductions of withholding tax at the prevailing rates as per The Income Tax Act, 1961.</li>

        <li>You agree not to use or disclose to third parties any confidential information which you will have access to during the course of providing service.</li>

        <li>The following shall be an integral part of the deliverable: Your opinion/surveys on the topics for which your expert advice has been sought for under this Agreement on your letter head.</li>

        <li>Emcure confirms that your responsibilities as Emcure's Expert are in no way linked to or dependent on your prescribing or promoting Emcure's products.</li>

        <li>You agree to fulfill all the obligations under this Agreement in accordance with any professional standards, applicable laws and regulations.</li>

        <li>By signing below, you agree not to disclose any confidential or proprietary information to third parties.</li>

        <li>Any documentation and data created within the scope of this agreement shall be the sole and exclusive property of Emcure.</li>

        <li>You confirm that you have no conflict of interest which would prevent you from acting as an Expert in accordance with this Agreement.</li>

        <li>Emcure encourages you to be transparent about your involvement as Expert.</li>

        <li>Neither party may assign its rights or otherwise transfer this Agreement without the prior written consent of the other party.</li>

        <li>The parties are independent contractors and nothing in this Agreement implies any partnership, agency or employment relationship.</li>

        <li>This Agreement constitutes the entire agreement of the parties and supersedes any verbal or other agreements.</li>

        <li>This Agreement is governed by and constructed in accordance with laws of India. Any dispute shall be decided by arbitration under the Arbitration and Conciliation Act, 1996 at Pune.</li>
      </ol>

      <div className="mt-8 grid grid-cols-2 gap-8 border-t pt-6">
        <div>
          <p className="font-semibold">HCP Name:</p>
          <p>{doctor.name_as_per_pan || doctor.doctor_name}</p>
          <p className="mt-4 font-semibold">HCP Signature:</p>
          <div className="h-16 border-b border-gray-400 mt-2" id="signature-placeholder"></div>
        </div>
        <div>
          <p className="font-semibold">Emcure Authorized Signatory</p>
          <p>Name: _______________</p>
          <p className="mt-4">Sign: _______________</p>
        </div>
      </div>
    </div>
  )
}

export default function SurveyPortal() {
  const { token } = useParams()
  const [step, setStep] = useState('details')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['doctor-portal', token],
    queryFn: () => brsApi.doctorPortalGet(token).then(r => r.data),
  })

  // Load existing uploaded documents
  const { data: existingDocs } = useQuery({
    queryKey: ['doctor-docs', token],
    queryFn: () => brsApi.doctorListDocuments(token).then(r => r.data),
  })

  useEffect(() => {
    if (existingDocs) setUploadedDocs(existingDocs)
  }, [existingDocs])

  const [details, setDetails] = useState({})
  const [uploadedDocs, setUploadedDocs] = useState([])
  const updateDetails = useMutation({
    mutationFn: (d) => brsApi.doctorUpdateDetails(token, d),
    onSuccess: () => { toast.success('Details saved'); setStep('agreement'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const signAgreement = useMutation({
    mutationFn: (signature) => brsApi.doctorSignAgreement(token, signature),
    onSuccess: () => { toast.success('Agreement signed'); setStep('survey'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const [responses, setResponses] = useState({})
  const submitSurvey = useMutation({
    mutationFn: () => {
      // Build responses with question text for display purposes
      const formattedResponses = {}
      survey?.questions?.forEach(q => {
        formattedResponses[q.id] = {
          question: q.question_text,
          question_type: q.question_type,
          answer: responses[q.id] || null,
        }
      })
      return brsApi.doctorSubmitSurvey(token, { responses: formattedResponses })
    },
    onSuccess: () => { toast.success('Survey submitted!'); setStep('done'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>
  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-500">Invalid or expired link</div>

  const { doctor, brs, survey } = data

  // Auto-determine step
  if (doctor.survey_completed) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card max-w-md text-center space-y-4">
        <CheckCircle size={48} className="text-emerald-500 mx-auto" />
        <h2 className="text-xl font-bold">Survey Completed</h2>
        <p className="text-gray-500">Thank you, {doctor.doctor_name}. Your survey has been submitted successfully.</p>
      </div>
    </div>
  )

  // Set initial step based on status
  if (step === 'details' && doctor.agreement_signed) {
    setTimeout(() => setStep('survey'), 0)
  } else if (step === 'details' && doctor.doctor_status === 'Details Updated') {
    setTimeout(() => setStep('agreement'), 0)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="card mb-6">
          <h1 className="text-xl font-bold">{brs.title}</h1>
          <p className="text-sm text-gray-500">BRS: {brs.brs_code} • Welcome, Dr. {doctor.doctor_name}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 mb-6">
          {[
            { key: 'details', label: 'Update Details', icon: Edit2 },
            { key: 'agreement', label: 'Sign Agreement', icon: FileSignature },
            { key: 'survey', label: 'Fill Survey', icon: ClipboardList },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === s.key ? 'bg-blue-600 text-white' :
                (s.key === 'details' && (step === 'agreement' || step === 'survey')) ||
                (s.key === 'agreement' && step === 'survey') ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                <s.icon size={14} />
              </div>
              <span className={`text-xs ${step === s.key ? 'font-semibold' : 'text-gray-400'}`}>{s.label}</span>
              {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step: Update Details */}
        {step === 'details' && (
          <div className="card space-y-4">
            <h3 className="font-semibold">Update Your Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Name As Per PAN *</label><input className="input" defaultValue={doctor.name_as_per_pan || doctor.doctor_name} onChange={e => setDetails(d => ({...d, name_as_per_pan: e.target.value}))} /></div>
              <div><label className="label">PAN Number *</label><input className="input" defaultValue={doctor.pan_number || ''} onChange={e => setDetails(d => ({...d, pan_number: e.target.value}))} /></div>
              <div><label className="label">Email *</label><input className="input" defaultValue={doctor.email || ''} onChange={e => setDetails(d => ({...d, email: e.target.value}))} /></div>
              <div><label className="label">Mobile</label><input className="input" defaultValue={doctor.mobile || ''} onChange={e => setDetails(d => ({...d, mobile: e.target.value}))} /></div>
              <div><label className="label">Speciality</label><input className="input" defaultValue={doctor.speciality || ''} onChange={e => setDetails(d => ({...d, speciality: e.target.value}))} /></div>
            </div>

            {/* Document Upload Section */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Upload Documents (Mandatory)</h4>
              <p className="text-xs text-gray-500 mb-3">Upload PNG, JPEG, or PDF files only</p>
              <div className="space-y-3">
                {[
                  { type: 'pan_copy', label: 'PAN Card Copy *' },
                  { type: 'cancelled_cheque', label: 'Cancelled Cheque *' },
                  { type: 'letterhead', label: 'Letter Head / Visiting Card *' },
                  { type: 'others', label: 'Other Documents (multiple allowed)' },
                ].map(docType => (
                  <div key={docType.type} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{docType.label}</p>
                      {uploadedDocs.filter(d => d.document_type === docType.type).map(d => (
                        <div key={d.id} className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-emerald-600">✓ {d.document_name}</span>
                          <button className="text-xs text-red-400 hover:text-red-600" onClick={async () => {
                            await brsApi.doctorDeleteDocument(token, d.id)
                            setUploadedDocs(prev => prev.filter(x => x.id !== d.id))
                          }}>Remove</button>
                        </div>
                      ))}
                    </div>
                    <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                      Upload
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf"
                        onClick={e => { e.target.value = null }}
                        onChange={async e => {
                          const file = e.target.files[0]
                          if (!file) return
                          const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
                          if (!allowed.includes(file.type)) { toast.error('Only PNG, JPEG, or PDF allowed'); return }
                          const formData = new FormData()
                          formData.append('file', file)
                          formData.append('document_type', docType.type)
                          try {
                            const res = await brsApi.doctorUploadDocument(token, formData)
                            setUploadedDocs(prev => [...prev, res.data])
                            toast.success('Uploaded')
                          } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => {
                // Validate mandatory documents
                const hasPan = uploadedDocs.some(d => d.document_type === 'pan_copy')
                const hasCheque = uploadedDocs.some(d => d.document_type === 'cancelled_cheque')
                const hasLetterhead = uploadedDocs.some(d => d.document_type === 'letterhead')
                if (!hasPan || !hasCheque || !hasLetterhead) {
                  toast.error('Please upload all mandatory documents (PAN, Cancelled Cheque, Letterhead)')
                  return
                }
                updateDetails.mutate(details)
              }} disabled={updateDetails.isPending}>
                {updateDetails.isPending ? 'Saving…' : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Sign Agreement */}
        {step === 'agreement' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold mb-4">Expert Services Agreement</h3>
              <div className="border rounded-lg p-6 max-h-[500px] overflow-y-auto bg-white">
                <AgreementDocument doctor={doctor} brs={brs} survey={survey} />
              </div>
            </div>
            <div className="card">
              <label className="flex items-center gap-2 text-sm mb-4">
                <input type="checkbox" id="agree-check" />
                I have read and agree to all the terms and conditions of this Expert Services Agreement.
              </label>
              <SignaturePad onSave={(signatureData) => {
                if (!document.getElementById('agree-check').checked) { toast.error('Please agree to the terms first'); return }
                signAgreement.mutate(signatureData)
              }} />
            </div>
          </div>
        )}

        {/* Step: Fill Survey */}
        {step === 'survey' && survey && (
          <div className="card space-y-4">
            <h3 className="font-semibold">{survey.title}</h3>
            <div className="space-y-4">
              {survey.questions?.map(q => (
                <div key={q.id} className="border rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">{q.order_no}. {q.question_text} {q.is_required && <span className="text-red-500">*</span>}</p>
                  {q.question_type === 'free_text' && (
                    <textarea className="input h-16" onChange={e => setResponses(r => ({...r, [q.id]: e.target.value}))} />
                  )}
                  {q.question_type === 'single_select' && (
                    <select className="input" onChange={e => setResponses(r => ({...r, [q.id]: e.target.value}))}>
                      <option value="">Select</option>
                      {q.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {q.question_type === 'multi_select' && (
                    <div className="space-y-1">
                      {q.options?.map(o => (
                        <label key={o} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" onChange={e => {
                            setResponses(r => {
                              const curr = r[q.id] || []
                              return {...r, [q.id]: e.target.checked ? [...curr, o] : curr.filter(x => x !== o)}
                            })
                          }} />
                          {o}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.question_type === 'fill_in_blanks' && (
                    <div className="text-sm leading-relaxed">
                      {q.question_text.split('___').map((part, i, arr) => (
                        <span key={i}>
                          {i > 0 && (
                            <input
                              type="text"
                              className="inline-block w-32 mx-1 px-2 py-0.5 border-b-2 border-blue-400 bg-blue-50 text-center text-sm focus:outline-none focus:border-blue-600"
                              placeholder={`blank ${i}`}
                              onChange={e => {
                                setResponses(r => {
                                  const blanks = r[q.id] || []
                                  const updated = [...blanks]
                                  updated[i - 1] = e.target.value
                                  return {...r, [q.id]: updated}
                                })
                              }}
                            />
                          )}
                          {part}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button className="btn-primary bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                // Validate required questions
                const missing = survey.questions?.filter(q => {
                  if (!q.is_required) return false
                  const answer = responses[q.id]
                  if (!answer) return true
                  if (Array.isArray(answer) && answer.length === 0) return true
                  if (typeof answer === 'string' && !answer.trim()) return true
                  return false
                }) || []
                if (missing.length > 0) {
                  toast.error(`Please answer all required questions. Missing: Q${missing.map(q => q.order_no).join(', Q')}`)
                  return
                }
                submitSurvey.mutate()
              }} disabled={submitSurvey.isPending}>
                {submitSurvey.isPending ? 'Submitting…' : '✓ Submit Survey'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
