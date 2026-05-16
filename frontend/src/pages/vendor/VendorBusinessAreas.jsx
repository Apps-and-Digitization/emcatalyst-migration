import { vendorApi } from '../../api/endpoints'
import SimpleVendorList from './SimpleVendorList'

export default function VendorBusinessAreas() {
  return (
    <SimpleVendorList
      title="Business Areas"
      subtitle="Manage vendor business areas"
      queryKey="vendor-business-areas"
      fetchFn={vendorApi.businessAreas}
      createFn={vendorApi.createBusinessArea}
      updateFn={vendorApi.updateBusinessArea}
      deleteFn={vendorApi.deleteBusinessArea}
    />
  )
}
