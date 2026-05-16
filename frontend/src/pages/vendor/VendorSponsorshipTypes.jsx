import { vendorApi } from '../../api/endpoints'
import SimpleVendorList from './SimpleVendorList'

export default function VendorSponsorshipTypes() {
  return (
    <SimpleVendorList
      title="Sponsorship Request Types"
      subtitle="Manage types of sponsorship requests"
      queryKey="vendor-sponsorship-types"
      fetchFn={vendorApi.sponsorshipRequestTypes}
      createFn={vendorApi.createSponsorshipRequestType}
      updateFn={vendorApi.updateSponsorshipRequestType}
      deleteFn={vendorApi.deleteSponsorshipRequestType}
    />
  )
}
