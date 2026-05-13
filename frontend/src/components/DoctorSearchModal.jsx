import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { masterApi } from '../api/endpoints'
import Modal from './ui/Modal'
import { Search, CheckCircle } from 'lucide-react'

function fmtCurrency(val) {
  if (!val && val !== 0) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
}

export default function DoctorSearchModal({ open, onClose, onSelect }) {
  const [searchQ, setSearchQ] = useState('')

  const { data: doctors = [], isFetching } = useQuery({
    queryKey: ['hcp-doctors-search', searchQ],
    queryFn: () => masterApi.hcpDoctors(searchQ || null, 100).then(r => r.data),
    enabled: open,
  })

  return (
    <Modal open={open} onClose={onClose} title="Search MCL / HCP Doctor" size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            className="input pl-9"
            placeholder="Search by name, PAN, city, email…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>

        <p className="text-xs text-gray-400">
          {isFetching ? 'Searching…' : `${doctors.length} doctor(s) found`}
        </p>

        <div className="overflow-y-auto max-h-80 divide-y border rounded-lg">
          {doctors.length === 0 && !isFetching && (
            <div className="p-4 text-center text-sm text-gray-400">
              {searchQ ? 'No doctors found' : 'Start typing to search'}
            </div>
          )}
          {doctors.map(doc => (
            <button
              key={doc.id}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3"
              onClick={() => { onSelect(doc); onClose() }}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {(doc.full_name || doc.first_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">
                  {doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim()}
                  {doc.qualification && <span className="text-gray-500 font-normal"> ({doc.qualification})</span>}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {doc.uid_number && <span className="font-mono text-blue-600">{doc.uid_number}</span>}
                  {doc.uid_number && ' • '}
                  {[doc.city, doc.state].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-blue-600">
                  Rate: {fmtCurrency(doc.hourly_rate)}/hr
                  {doc.max_capping && ` • Cap: ${fmtCurrency(doc.max_capping)}`}
                </p>
              </div>
              <CheckCircle size={16} className="shrink-0 text-emerald-500 mt-1" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
