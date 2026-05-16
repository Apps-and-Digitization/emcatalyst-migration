import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import useJobStore from '../../store/jobStore'

export default function VendorList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [importing, setImporting] = useState(false)

  const { data: vendorData = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['vendors', search, page, pageSize],
    queryFn: () => vendorApi.vendors(search || undefined, page, pageSize).then(r => r.data),
  })

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await vendorApi.importVendors()
      const { job_id } = res.data
      useJobStore.getState().addJob(job_id)
      toast.success('Import started — check the progress panel')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start import')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-8">
      <PageHeader title="Vendors" subtitle="Manage vendor master data"
        actions={
          <button onClick={handleImport} disabled={importing} className="btn-primary flex items-center gap-2">
            <Download size={16} />
            {importing ? 'Importing...' : 'Import Vendors'}
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search by name, vendor code, PAN..." className="input pl-9 w-full"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {/* Table */}
      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Vendor Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Company Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Bank Account Number</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">IFSC Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">PAN Number</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">GST Number</th>
                </tr>
              </thead>
              <tbody>
                {vendorData.items.map(v => (
                  <tr key={v.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{v.lifnr}</td>
                    <td className="px-4 py-2 text-gray-600">{v.bukrs}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{v.name}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{v.bankn}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{v.bankl}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{v.pan_number}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{v.gst_number}</td>
                  </tr>
                ))}
                {vendorData.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No vendors found</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={vendorData.total}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </div>
      )}
    </div>
  )
}
