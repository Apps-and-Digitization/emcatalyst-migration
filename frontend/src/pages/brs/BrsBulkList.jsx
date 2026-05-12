import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, Users } from 'lucide-react'
import { brsApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const STATUS_COLORS = {
  'Draft': 'bg-gray-100 text-gray-600',
  'Pending L1': 'bg-yellow-100 text-yellow-700',
  'Pending L2': 'bg-orange-100 text-orange-700',
  'Completed': 'bg-green-100 text-green-700',
}

export default function BrsBulkList() {
  const navigate = useNavigate()

  const { data: bulkList = [], isLoading } = useQuery({
    queryKey: ['brs-bulk-list'],
    queryFn: () => brsApi.bulkList().then(r => r.data),
  })

  return (
    <div className="p-8">
      <PageHeader
        title="Bulk BRS Requests"
        subtitle="Send the same survey to multiple doctors simultaneously"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs')}>
              <ArrowLeft size={16} /> Back to BRS
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/brs/bulk/new')}>
              <Plus size={16} /> New Bulk Request
            </button>
          </div>
        }
      />

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Bulk Code', 'Survey Title', 'Brand', 'Honorarium', 'Doctors', 'Sent', 'Completed', 'Status', 'Created By', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bulkList.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  No bulk requests yet.
                  <button className="ml-2 text-blue-600 underline" onClick={() => navigate('/brs/bulk/new')}>Create one</button>
                </td></tr>
              ) : bulkList.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/brs/bulk/${b.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{b.bulk_code}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{b.survey_title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.brand || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {b.honorarium_amount > 0 ? `₹${b.honorarium_amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="flex items-center gap-1"><Users size={12} /> {b.total_doctors}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.sent_count}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.completed_count}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.initiator_name || '—'}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:underline text-xs">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
