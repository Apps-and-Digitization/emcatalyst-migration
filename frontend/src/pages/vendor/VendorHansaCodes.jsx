import { vendorApi } from '../../api/endpoints'
import SimpleVendorList from './SimpleVendorList'

export default function VendorHansaCodes() {
  return (
    <SimpleVendorList
      title="HANSA Codes"
      subtitle="Manage HANSA codes"
      queryKey="vendor-hansa-codes"
      fetchFn={vendorApi.hansaCodes}
      createFn={vendorApi.createHansaCode}
      updateFn={vendorApi.updateHansaCode}
      deleteFn={vendorApi.deleteHansaCode}
      fieldName="code"
      fieldLabel="Code"
    />
  )
}
