import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Search, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { reportsApi } from '../../api/endpoints'
import { accessApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function EventReport() {
  const [filters, setFilters] = useState({ division_id: '', status: '', from_date: '', to_date: '' })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-list'],
    queryFn: () => accessApi.listDivisions().then(r => r.data),
  })

  const { data: reportData = [], isLoading, refetch } = useQuery({
    queryKey: ['event-report', filters],
    queryFn: () => {
      const params = {}
      if (filters.division_id) params.division_id = filters.division_id
      if (filters.status) params.status = filters.status
      if (filters.from_date) params.from_date = filters.from_date
      if (filters.to_date) params.to_date = filters.to_date
      return reportsApi.eventReport(params).then(r => r.data)
    },
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(reportData, 50)

  const exportToExcel = () => {
    const headers = [
      'CompanyName', 'Division', 'EventCode', 'EventType', 'EventCategory',
      'SponsorshipType', 'EventTitle', 'EventTopic', 'EventStartDate', 'EventEndDate',
      'EventCity', 'EventVenue', 'PlatformOfEvent', 'TotalCost', 'EventCost',
      'HonorariumAmount', 'EventStatus', 'ApprovalStatus', 'InitiatorName',
      'InitiatedDate', 'Speakers', 'Brand', 'Count'
    ]
    const rows = reportData.map(r => [
      r.company_name, r.division, r.event_code, r.event_type, r.event_category,
      r.sponsorship_type, r.event_title, r.event_topic, r.event_start_date, r.event_end_date,
      r.event_city, r.event_venue, r.platform_of_event, r.total_cost, r.event_cost,
      r.honorarium_amount, r.event_status, r.approval_status, r.initiator_name,
      r.initiated_date, r.speakers, r.brand, r.count
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Event Report')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `EventReport_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Event Report"
        subtitle="Comprehensive event data export"
        actions={
          <button onClick={exportToExcel} disabled={reportData.length === 0} className="btn-primary flex items-center gap-2">
            <Download size={16} />
            Export to Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
            <select
              className="input w-full"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Pre-Approved">Pre-Approved</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
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
          <div className="overflow-auto max-h-[calc(100vh-420px)]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Company</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Division</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Event Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">City</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Start Date</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Total Cost</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Initiator</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{r.company_name}</td>
                    <td className="px-3 py-2 text-gray-700">{r.division}</td>
                    <td className="px-3 py-2 font-mono text-gray-800">{r.event_code}</td>
                    <td className="px-3 py-2 text-gray-600">{r.event_type}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{r.event_title}</td>
                    <td className="px-3 py-2 text-gray-600">{r.event_city}</td>
                    <td className="px-3 py-2 text-gray-600">{r.event_start_date}</td>
                    <td className="px-3 py-2 text-right text-gray-800">₹{r.total_cost?.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{r.approval_status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.initiator_name}</td>
                  </tr>
                ))}
                {paginatedItems.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
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
