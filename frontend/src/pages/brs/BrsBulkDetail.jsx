import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle, Clock, Users, Send, ExternalLink
} from 'lucide-react'
import { brsApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const STATUS_COLORS = {
  'Draft': 'bg-gray-100 text-gray-600',
  'Pending L1': 'bg-yellow-100 text-yellow-700',
  'Pending L2': 'bg-orange-100 text-orange-700',
  'Pending Compliance': 'bg-purple-100 text-purple-700',
  'Pending HCP Form': 'bg-blue-100 text-blue-700',
  'Pending Survey': 'bg-indigo-100 text-indigo-700',
  'Pending Sign': 'bg-pink-100 text-pink-700',
  'Survey Completed': 'bg-teal-100 text-teal-700',
  'Pending Coord. Verification': 'bg-cyan-100 text-cyan-700',
  'Pending Vendor Creation': 'bg-amber-100 text-amber-700',
  'Pending Finance': 'bg-lime-100 text-lime-700',
  'Posted': 'bg-green-100 text-green-700',
  'Paid': 'bg-emerald-100 text-emerald-800',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BrsBulkDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: bulk, isLoading } = useQuery({
    queryKey: ['brs-bulk', id],
    queryFn: () => brsApi.bulkGet(id).then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: () => brsApi.bulkSubmit(id),
    onSuccess: (res) => {
      toast.success(`${res.data.submitted} applications submitted for L1 approval`)
      queryClient.invalidateQueries({ queryKey: ['brs-bulk', id] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Submit failed'),
  })

  if (isLoading) return <div className="p-8"><LoadingSpinner /></div>
  if (!bulk) return <div className="p-8 text-gray-500">Bulk request not found.</div>

  const completedCount = bulk.doctors?.filter(d => d.survey_completed_at).length || 0
  const signedCount = bulk.doctors?.filter(d => d.agreement_signed_at).length || 0
  const sentCount = bulk.doctors?.filter(d => d.survey_link_sent_at).length || 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title={`Bulk BRS — ${bulk.bulk_code}`}
        subtitle={bulk.survey_title}
        actions={
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs/bulk')}>
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Doctors', value: bulk.total_doctors, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Links Sent', value: sentCount, icon: Send, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Surveys Completed', value: completedCount, icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Agreements Signed', value: signedCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Details card */}
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-gray-500 mb-0.5">Status</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_COLORS[bulk.status] || 'bg-gray-100 text-gray-600'}`}>{bulk.status}</span>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Honorarium</p>
            <p className="font-medium">{bulk.honorarium_amount > 0 ? `₹${bulk.honorarium_amount.toLocaleString('en-IN')}` : '—'}</p>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Survey Duration</p>
            <p className="font-medium">{bulk.survey_duration_days || 7} days</p>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Initiated By</p>
            <p className="font-medium">{bulk.initiator_name || '—'}</p>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Therapeutic Area</p>
            <p className="font-medium">{bulk.therapeutic_area || '—'}</p>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Brand</p>
            <p className="font-medium">{bulk.brand || '—'}</p>
          </div>
          <div><p className="text-xs text-gray-500 mb-0.5">Created</p>
            <p className="font-medium">{fmt(bulk.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Submit for approval */}
      {bulk.status === 'Draft' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between mb-6">
          <div>
            <p className="font-medium text-blue-800">Ready to submit for approval?</p>
            <p className="text-sm text-blue-600">This will submit all {bulk.total_doctors} applications for L1/L2 approval.</p>
          </div>
          <button className="btn-primary" disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? 'Submitting…' : 'Submit All for Approval'}
          </button>
        </div>
      )}

      {/* Per-doctor table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Doctor Status Tracker</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['#', 'BRS Code', 'Doctor', 'Email / Phone', 'City', 'Status', 'Link Sent', 'Survey Done', 'Agreement Signed', ''].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(bulk.doctors || []).map((d, i) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-3 py-3 font-mono text-xs text-blue-600">{d.brs_code}</td>
                <td className="px-3 py-3 font-medium text-sm">{d.doctor?.name || '—'}</td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  <div>{d.doctor?.email || '—'}</div>
                  <div>{d.doctor?.phone || ''}</div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{d.doctor?.city || '—'}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600'}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{fmt(d.survey_link_sent_at)}</td>
                <td className="px-3 py-3 text-xs">
                  {d.survey_completed_at
                    ? <span className="text-teal-600 flex items-center gap-1"><CheckCircle size={12} /> {fmt(d.survey_completed_at)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-xs">
                  {d.agreement_signed_at
                    ? <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12} /> {fmt(d.agreement_signed_at)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  <button className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                    onClick={() => navigate(`/brs/${d.id}`)}>
                    <ExternalLink size={12} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
