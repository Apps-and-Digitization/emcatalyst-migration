import { vendorApi } from '../../api/endpoints'
import SimpleVendorList from './SimpleVendorList'

export default function VendorBusinessPlaces() {
  return (
    <SimpleVendorList
      title="Business Places"
      subtitle="Manage vendor business places"
      queryKey="vendor-business-places"
      fetchFn={vendorApi.businessPlaces}
      createFn={vendorApi.createBusinessPlace}
      updateFn={vendorApi.updateBusinessPlace}
      deleteFn={vendorApi.deleteBusinessPlace}
    />
  )
}
