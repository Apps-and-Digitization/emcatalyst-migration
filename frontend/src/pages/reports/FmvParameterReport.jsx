import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { reportsApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function FmvParameterReport() {
  const [filters, setFilters] = useState({ from_date: '', to_date: '' })

  const { data: reportData = [], isLoading } = useQuery({
    queryKey: ['fmv-parameter-report', filters],
    queryFn: () => {
      const params = {}
      if (filters.from_date) params.from_date = filters.from_date
      if (filters.to_date) params.to_date = filters.to_date
      return reportsApi.fmvParameterReport(params).then(r => r.data)
    },
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(reportData, 50)

  const exportToExcel = () => {
    const headers = [
      'Event Code', 'PrePost', 'Status', 'Sub Application Number', 'Doctor',
      'Hourly Rate', 'Maximum Capping',
      'Clinical Practice Experience',
      'Experience as Investigator in Clinical Trials',
      'Area of Expertise',
      'Professional Position',
      'Prior Experience of Congresses',
      'Publications in Literature'
    ]
    const rows = reportData.map(r => [
      r.event_code, r.pre_post, r.status, r.sub_application_number, r.doctor,
      r.hourly_rate, r.maximum_capping,
      r.clinical_practice_experience,
      r.experience_as_investigator,
      r.expertise,
      r.professional_position,
      r.prior_experience_of_congresses,
      r.publications_in_literature
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'FMV Parameters')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `FMV_Parameter_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="FMV Parameter Report"
        subtitle="Fair Market Value parameter data for event doctors"
        actions={
          <button onClick={exportToExcel} disabled={reportData.length === 0} className="btn-primary flex items-center gap-2">
            <Download size={16} />
            Export to Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Event Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Pre/Post</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Doctor</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Hourly Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Max Capping</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Clinical Practice Experience</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Investigator Experience</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Expertise</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Professional Position</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Congress Experience</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Publications</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-800">{r.event_code}</td>
                    <td className="px-3 py-2">
                      {r.pre_post && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${r.pre_post === 'Pre' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {r.pre_post}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.status}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate" title={r.doctor}>{r.doctor}</td>
                    <td className="px-3 py-2 text-right text-gray-800">₹{r.hourly_rate?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-800">₹{r.maximum_capping?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-600">{r.clinical_practice_experience}</td>
                    <td className="px-3 py-2 text-gray-600">{r.experience_as_investigator}</td>
                    <td className="px-3 py-2 text-gray-600">{r.expertise}</td>
                    <td className="px-3 py-2 text-gray-600">{r.professional_position}</td>
                    <td className="px-3 py-2 text-gray-600">{r.prior_experience_of_congresses}</td>
                    <td className="px-3 py-2 text-gray-600">{r.publications_in_literature}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
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
