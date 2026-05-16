import { vendorApi } from '../../api/endpoints'
import SimpleVendorList from './SimpleVendorList'

export default function VendorTaxCodes() {
  return (
    <SimpleVendorList
      title="Tax Codes"
      subtitle="Manage vendor tax codes"
      queryKey="vendor-tax-codes"
      fetchFn={vendorApi.taxCodes}
      createFn={vendorApi.createTaxCode}
      updateFn={vendorApi.updateTaxCode}
      deleteFn={vendorApi.deleteTaxCode}
      fieldName="code"
      fieldLabel="Code"
    />
  )
}
