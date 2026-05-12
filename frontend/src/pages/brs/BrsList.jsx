import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ClipboardList, CheckCircle, Clock, PenLine,
  ChevronLeft, ChevronRight, FileText
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
  'Paid': 'bg-emerald-100 text-emerald-800 font-semibold',
}

const PAGE_SIZE = 20

export default function BrsList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data: dashboard } = useQuery({
    queryKey: ['brs-dashboard'],
    queryFn: () => brsApi.dashboard().then(r => r.data),
  })

  const { data: listData = { total: 0, items: [] }, isLoading } = useQuery({
    queryKey: ['brs-list', statusFilter, search, page],
    queryFn: () => brsApi.list({
      status: statusFilter || undefined,
      search: search || undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE
    }).then(r => r.data),
  })

  const totalPages = Math.ceil(listData.total / PAGE_SIZE)

  const stats = [
    { label: 'Total Applications', value: dashboard?.total ?? '—', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Agreements Sent', value: dashboard?.agreements_sent ?? '—', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Surveys In Progress', value: dashboard?.in_progress ?? '—', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Surveys Completed', value: dashboard?.survey_completed ?? '—', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Signature', value: dashboard?.pending_sign ?? '—', icon: PenLine, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Paid', value: dashboard?.completed ?? '—', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Bona Fide Research Survey (BRS)"
        subtitle="Manage doctor survey engagements, agreements and honorarium payments"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"
              onClick={() => navigate('/brs/survey-builder')}>
              <FileText size={16} /> Survey Builder
            </button>
            <button className="btn-primary flex items-center gap-2"
              onClick={() => navigate('/brs/new')}>
              <Plus size={16} /> New BRS Application
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="card p-4">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by title or BRS code…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input w-56" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['BRS Code', 'Survey Title', 'Doctor', 'Honorarium', 'Mode', 'Status', 'Created By', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listData.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No BRS applications found.
                  <button className="ml-2 text-blue-600 underline"
                    onClick={() => navigate('/brs/new')}>Create one</button>
                </td></tr>
              ) : listData.items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/brs/${a.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{a.brs_code}</td>
                  <td className="px-4 py-3 font-medium max-w-[220px] truncate">{a.survey_title}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{a.doctor_name || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {a.honorarium_amount > 0 ? `₹${a.honorarium_amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.mode}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.initiator_name || '—'}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:underline text-xs">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, listData.total)} of {listData.total}
              </p>
              <div className="flex gap-1">
                <button className="btn-secondary py-1 px-2 text-xs" disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`py-1 px-2.5 rounded text-xs ${pg === page ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>{pg}</button>
                ))}
                {totalPages > 8 && <span className="text-xs text-gray-400 self-center px-1">…{totalPages}</span>}
                <button className="btn-secondary py-1 px-2 text-xs" disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
