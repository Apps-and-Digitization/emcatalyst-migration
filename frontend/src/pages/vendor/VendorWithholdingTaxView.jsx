import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'

export default function VendorWithholdingTaxView() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [expandedVendorId, setExpandedVendorId] = useState(null)

  const { data: vendorData = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['vendors-wht-view', search, page, pageSize],
    queryFn: () => vendorApi.vendors(search || undefined, page, pageSize).then(r => r.data),
  })

  const { data: vendorDetail, isFetching: detailLoading } = useQuery({
    queryKey: ['vendor-detail', expandedVendorId],
    queryFn: () => vendorApi.vendor(expandedVendorId).then(r => r.data),
    enabled: !!expandedVendorId,
  })

  const toggleExpand = (vendorId) => {
    setExpandedVendorId(expandedVendorId === vendorId ? null : vendorId)
  }

  return (
    <div className="p-8">
      <PageHeader title="Vendor Withholding Tax" subtitle="View withholding tax codes assigned to each vendor" />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search vendors..." className="input pl-9 w-full"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Vendor Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Company Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">PAN Number</th>
                </tr>
              </thead>
              <tbody>
                {vendorData.items.map(v => (
                  <Fragment key={v.id}>
                    <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(v.id)}>
                      <td className="px-4 py-2 text-gray-400">
                        {expandedVendorId === v.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{v.lifnr}</td>
                      <td className="px-4 py-2 font-medium text-gray-800">{v.name}</td>
                      <td className="px-4 py-2 text-gray-600">{v.bukrs}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{v.pan_number}</td>
                    </tr>
                    {expandedVendorId === v.id && (
                      <tr>
                        <td colSpan={5} className="px-8 py-3 bg-gray-50">
                          {detailLoading ? (
                            <p className="text-xs text-gray-400">Loading...</p>
                          ) : vendorDetail?.withholding_taxes?.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Withholding Taxes ({vendorDetail.withholding_taxes.length})</p>
                              <table className="w-full text-xs border rounded">
                                <thead className="bg-white">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Tax Code</th>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Name</th>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Section</th>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Rate</th>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">WithT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {vendorDetail.withholding_taxes.map(t => (
                                    <tr key={t.id} className="border-t">
                                      <td className="px-3 py-1.5 font-mono">{t.tax_code}</td>
                                      <td className="px-3 py-1.5">{t.name}</td>
                                      <td className="px-3 py-1.5">{t.section}</td>
                                      <td className="px-3 py-1.5">{t.rate}</td>
                                      <td className="px-3 py-1.5">{t.with_t}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No withholding taxes assigned</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {vendorData.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No vendors found</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={vendorData.total}
            onPageChange={p => setPage(p)} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
        </div>
      )}
    </div>
  )
}
