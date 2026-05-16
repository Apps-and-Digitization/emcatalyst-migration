import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { reportsApi, accessApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function CmeEventReport() {
  const [filters, setFilters] = useState({ division_id: '', from_date: '', to_date: '' })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-list'],
    queryFn: () => accessApi.listDivisions().then(r => r.data),
  })

  const { data: reportData = [], isLoading } = useQuery({
    queryKey: ['cme-event-report', filters],
    queryFn: () => {
      const params = {}
      if (filters.division_id) params.division_id = filters.division_id
      if (filters.from_date) params.from_date = filters.from_date
      if (filters.to_date) params.to_date = filters.to_date
      return reportsApi.cmeEventReport(params).then(r => r.data)
    },
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(reportData, 50)

  const exportToExcel = () => {
    const headers = [
      'Division', 'Event Code', 'Event Title', 'Initiator', 'Event Date',
      'Type', 'Name', 'Hotel Name', 'City', 'State', 'Metro', 'Budget',
      'Count', 'Emcure Count', 'Food', 'Audio Video', 'Hall', 'Stay',
      'Number of Rooms', 'Cab', 'Flight', 'Event', 'Status', 'Location'
    ]
    const rows = reportData.map(r => [
      r.division, r.event_code, r.event_title, r.initiator, r.event_date,
      r.type, r.name, r.hotel_name, r.city, r.state, r.metro, r.budget,
      r.count, r.emcure_count, r.food, r.audio_video, r.hall, r.stay,
      r.number_of_rooms, r.cab, r.flight, r.event, r.status, r.location
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CME Report')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `CME_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="CME Event Report"
        subtitle="CME event cost breakdown report"
        actions={
          <button onClick={exportToExcel} disabled={reportData.length === 0} className="btn-primary flex items-center gap-2">
            <Download size={16} />
            Export to Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Division</label>
            <select
              className="input w-full"
              value={filters.division_id}
              onChange={e => setFilters(f => ({ ...f, division_id: e.target.value }))}
            >
              <option value="">All Divisions</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">From Date</label>
            <input
              type="date"
              className="input w-full"
              value={filters.from_date}
              onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">To Date</label>
            <input
              type="date"
              className="input w-full"
              value={filters.to_date}
              onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Results Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm text-gray-600">{total} records found</span>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-380px)]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Division</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Event Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Initiator</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">City</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Budget</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Food</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">AV</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Hall</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Stay</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Cab</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Flight</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{r.division}</td>
                    <td className="px-3 py-2 font-mono text-gray-800">{r.event_code}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{r.event_title}</td>
                    <td className="px-3 py-2 text-gray-600">{r.initiator}</td>
                    <td className="px-3 py-2 text-gray-600">{r.event_date}</td>
                    <td className="px-3 py-2 text-gray-600">{r.city}</td>
                    <td className="px-3 py-2 text-right text-gray-800">₹{r.budget?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.food?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.audio_video?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.hall?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.stay?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.cab?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{r.flight?.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{r.status}</span>
                    </td>
                  </tr>
                ))}
                {paginatedItems.length === 0 && (
                  <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </div>
      )}
    </div>
  )
}
