import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { brsApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function SurveyAnalyticsReport() {
  const [selectedSurveyId, setSelectedSurveyId] = useState('')
  const [selectedBrsId, setSelectedBrsId] = useState('')

  const { data: surveys = [], isLoading: loadingSurveys } = useQuery({
    queryKey: ['brs-surveys-for-analytics'],
    queryFn: () => brsApi.listSurveys().then(r => r.data),
  })

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['survey-analytics', selectedSurveyId, selectedBrsId],
    queryFn: () => brsApi.surveyAnalytics(selectedSurveyId, selectedBrsId || undefined).then(r => r.data),
    enabled: !!selectedSurveyId,
  })

  const handleExport = async () => {
    if (!selectedSurveyId) return
    try {
      const res = await brsApi.surveyAnalyticsExport(selectedSurveyId)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      // Get filename from Content-Disposition header or generate one
      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?(.+?)"?$/)
      const selectedSurvey = surveys.find(s => String(s.id) === String(selectedSurveyId))
      const surveyName = (selectedSurvey?.title || 'Survey').replace(/\s+/g, '_').slice(0, 40)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
      const filename = match?.[1] || `${surveyName}_Analytics_${timestamp}.xlsx`
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (e) {
      toast.error('Export failed')
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Survey Analytics"
        subtitle="View response analytics and export data for BRS surveys"
        actions={
          selectedSurveyId && analytics ? (
            <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
              <Download size={16} /> Export to Excel
            </button>
          ) : null
        }
      />

      {/* Survey Selector */}
      <div className="card p-5 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="label text-sm font-medium text-gray-700 mb-2 block">Select Survey</label>
            {loadingSurveys ? (
              <LoadingSpinner />
            ) : (
              <select
                className="input"
                value={selectedSurveyId}
                onChange={e => { setSelectedSurveyId(e.target.value); setSelectedBrsId('') }}
              >
                <option value="">— Choose a survey —</option>
                {surveys.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.division_name ? `(${s.division_name})` : ''} — {s.question_count} questions
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedSurveyId && analytics?.brs_applications?.length > 0 && (
            <div className="min-w-[250px]">
              <label className="label text-sm font-medium text-gray-700 mb-2 block">Filter by BRS (optional)</label>
              <select
                className="input"
                value={selectedBrsId}
                onChange={e => setSelectedBrsId(e.target.value)}
              >
                <option value="">All BRS Applications</option>
                {analytics.brs_applications.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.brs_code} — {b.title} ({b.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Content */}
      {!selectedSurveyId ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-[var(--color-primary-50)] rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} className="text-[var(--color-neutral-500)]" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-2">Select a Survey</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Choose a survey from the dropdown above to view response analytics.
          </p>
        </div>
      ) : loadingAnalytics ? (
        <LoadingSpinner />
      ) : analytics ? (
        <div className="space-y-6">
          {/* Completion Stats */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-800 mb-4">{analytics.survey_title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-800">{analytics.total_doctors_assigned}</p>
                <p className="text-sm text-gray-500 mt-1">Doctors Assigned</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{analytics.total_completed}</p>
                <p className="text-sm text-gray-500 mt-1">Surveys Completed</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-[var(--color-primary)]">{analytics.completion_rate}%</p>
                <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="h-4 rounded-full transition-all"
                style={{ width: `${analytics.completion_rate}%`, backgroundColor: 'var(--color-primary)' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">{analytics.total_completed} of {analytics.total_doctors_assigned} doctors completed the survey</p>
          </div>

          {/* BRS-wise Summary */}
          {analytics.brs_applications?.length > 0 && !selectedBrsId && (
            <div className="card p-5">
              <h4 className="font-semibold text-gray-700 mb-4">BRS-wise Summary</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="text-sm w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">BRS Code</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Title</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Doctors</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Completed</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Completion %</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.brs_applications.map(b => {
                      const brsDoctors = analytics.all_doctor_brs_map?.filter(r => r.brs_id === b.id) || []
                      const brsCompleted = brsDoctors.filter(r => r.completed_at).length
                      const brsTotal = brsDoctors.length
                      const brsPct = brsTotal > 0 ? Math.round((brsCompleted / brsTotal) * 100) : 0
                      return (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-[var(--color-primary)]">{b.brs_code}</td>
                          <td className="px-4 py-2">{b.title}</td>
                          <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'Completed' || b.status === 'Verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{b.status}</span></td>
                          <td className="px-4 py-2 text-center">{brsTotal}</td>
                          <td className="px-4 py-2 text-center text-emerald-600 font-medium">{brsCompleted}</td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-gray-100 rounded-full h-2">
                                <div className="h-2 rounded-full" style={{ width: `${brsPct}%`, backgroundColor: 'var(--color-primary)' }} />
                              </div>
                              <span className="text-xs text-gray-500">{brsPct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button className="text-xs text-[var(--color-primary)] hover:underline" onClick={() => setSelectedBrsId(String(b.id))}>
                              View Details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-question breakdown */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700">Question-wise Breakdown</h4>
            {analytics.questions.map((q, idx) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-sm bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2.5 py-1 rounded font-semibold">
                    Q{idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Type: {q.question_type.replace('_', ' ')} • {q.total_responses} response(s)
                    </p>
                  </div>
                </div>

                {(q.question_type === 'single_select' || q.question_type === 'multi_select') && q.responses ? (
                  <div className="space-y-3 pl-10">
                    {(q.options || Object.keys(q.responses)).map(opt => {
                      const count = q.responses[opt] || 0
                      const pct = q.total_responses > 0 ? Math.round((count / q.total_responses) * 100) : 0
                      return (
                        <div key={opt}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700">{opt}</span>
                            <span className="text-gray-500 font-medium">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3">
                            <div
                              className="h-3 rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : q.text_responses ? (
                  <div className="pl-10 max-h-60 overflow-y-auto space-y-2">
                    {q.text_responses.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No responses yet</p>
                    ) : q.text_responses.map((resp, i) => (
                      <div key={i} className="text-sm bg-gray-50 p-3 rounded border border-gray-100 text-gray-700">
                        {resp}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Individual Doctor Responses */}
          {analytics.individual_responses?.length > 0 && (
            <div className="card p-5">
              <h4 className="font-semibold text-gray-700 mb-4">Individual Doctor Responses</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="text-xs w-full min-w-[800px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50">Doctor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Completed</th>
                      {analytics.questions.map((q, idx) => (
                        <th key={q.id} className="px-3 py-2 text-left font-medium text-gray-600 max-w-[150px] truncate" title={q.question_text}>
                          Q{idx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.individual_responses.map((doc, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">{doc.doctor_name}</td>
                        <td className="px-3 py-2 text-gray-500">{doc.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{doc.completed_at ? new Date(doc.completed_at).toLocaleDateString('en-IN') : '—'}</td>
                        {analytics.questions.map(q => (
                          <td key={q.id} className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={doc.answers?.[String(q.id)] || ''}>
                            {doc.answers?.[String(q.id)] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">{analytics.individual_responses.length} doctor(s) completed the survey</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
