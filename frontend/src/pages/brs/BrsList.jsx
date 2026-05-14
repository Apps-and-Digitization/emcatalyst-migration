import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Upload, Trash2 } from 'lucide-react'
import { brsApi } from '../../api/endpoints'
import api from '../../api/client'
import { fmtDate } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import useAccessStore from '../../store/accessStore'
import useAuthStore from '../../store/authStore'

export default function BrsList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { accessiblePages } = useAccessStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator'
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['brs-list', statusFilter],
    queryFn: () => brsApi.list({ status: statusFilter || undefined }).then(r => r.data),
  })

  const items = data?.items || []
  const filtered = items.filter(i => !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.brs_code?.toLowerCase().includes(search.toLowerCase()))

  const canCreate = accessiblePages.includes('brs_create')
  const canBulkUpload = accessiblePages.includes('brs_bulk_upload')

  return (
    <div className="p-8">
      <PageHeader
        title="BRS Module"
        subtitle="Budget Request System"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs/survey-builder')}>
              Survey Builder
            </button>
            {canBulkUpload && (
              <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs/bulk-upload')}>
                <Upload size={16} /> Bulk Upload
              </button>
            )}
            {canCreate && (
              <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/brs/new')}>
                <Plus size={16} /> New BRS
              </button>
            )}
          </div>
        }
      />

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input pl-9" placeholder="Search by title or code…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="DH Approved">DH Approved</option>
          <option value="DH Rejected">DH Rejected</option>
          <option value="Doctor Pending">Doctor Pending</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No BRS records found" description="Create a new BRS to get started" />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['BRS Code', 'Title', 'Survey', 'Doctors', 'Created By', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.brs_code}</td>
                  <td className="px-4 py-3 font-medium">{item.title || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.survey_title || '—'}</td>
                  <td className="px-4 py-3 text-xs">{item.doctor_count || 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.created_by_name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(item.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:underline text-xs" onClick={() => navigate(`/brs/${item.id}`)}>View</button>
                      {isAdmin && (
                        <button className="text-red-500 hover:text-red-700 text-xs" onClick={async () => {
                          if (!confirm(`Delete BRS ${item.brs_code}?`)) return
                          try { await api.delete(`/brs/${item.id}`); qc.invalidateQueries(['brs-list']); } catch(e) { alert(e.response?.data?.detail || 'Error') }
                        }}>Delete</button>
                      )}
                    </div>
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
