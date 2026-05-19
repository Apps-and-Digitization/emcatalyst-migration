import api from './client'

// Auth
export const authApi = {
  login: (employeeId, password) => {
    const form = new URLSearchParams()
    form.append('username', employeeId)
    form.append('password', password)
    return api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  },
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (old_password, new_password) =>
    api.post('/auth/change-password', { old_password, new_password }),
  forgotPassword: (employee_id) =>
    api.post('/auth/forgot-password', { employee_id }),
  resetPassword: (token, new_password) =>
    api.post('/auth/reset-password', { token, new_password }),
  adminResetPassword: (userId, new_password) =>
    api.post(`/auth/users/${userId}/reset-password`, { new_password }),
  microsoftLogin: () => api.get('/auth/microsoft/login'),
  microsoftCallback: (code) => api.post('/auth/microsoft/callback', { code }),
  listUsers: (params) => api.get('/auth/users', { params }),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  getUserRoles: (id) => api.get(`/auth/users/${id}/roles`),
  assignUserRole: (id, role) => api.post(`/auth/users/${id}/roles`, null, { params: { role } }),
  removeUserRole: (id, role) => api.delete(`/auth/users/${id}/roles/${role}`),
  getUserDivisions: (id) => api.get(`/auth/users/${id}/divisions`),
  assignUserDivision: (id, division_id) => api.post(`/auth/users/${id}/divisions`, null, { params: { division_id } }),
  removeUserDivision: (id, division_id) => api.delete(`/auth/users/${id}/divisions/${division_id}`),
  importUsers: (employee_ids) => api.post('/auth/users/import', { employee_ids }),
}

// Events
export const eventsApi = {
  list: (params) => api.get('/events/', { params }),
  dashboard: () => api.get('/events/dashboard'),
  canCreate: () => api.get('/events/permissions/can-create'),
  workflowSteps: () => api.get('/events/permissions/workflow-steps'),
  checkBudget: (division_id, event_date) => api.get('/events/permissions/check-budget', { params: { division_id, event_date } }),
  create: (data) => api.post('/events/', data),
  get: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.put(`/events/${id}`, data),
  changeDate: (id, new_date, new_end_date) => api.put(`/events/${id}/change-date`, null, { params: { new_date, new_end_date } }),
  delete: (id) => api.delete(`/events/${id}`),
  submit: (id, remarks) => api.post(`/events/${id}/submit`, null, { params: { remarks } }),
  approveL1: (id, remarks) => api.post(`/events/${id}/approve-l1`, null, { params: { remarks } }),
  approveL2: (id, remarks) => api.post(`/events/${id}/approve-l2`, null, { params: { remarks } }),
  approveCompliance: (id, remarks) => api.post(`/events/${id}/approve-compliance`, null, { params: { remarks } }),
  approvePostL1: (id, remarks) => api.post(`/events/${id}/approve-post-l1`, null, { params: { remarks } }),
  approvePostL2: (id, remarks) => api.post(`/events/${id}/approve-post-l2`, null, { params: { remarks } }),
  approvePostCompliance: (id, remarks) => api.post(`/events/${id}/approve-post-compliance`, null, { params: { remarks } }),
  approvePostCoordinator: (id, remarks) => api.post(`/events/${id}/approve-post-coordinator`, null, { params: { remarks } }),
  approvePostGst: (id, remarks) => api.post(`/events/${id}/approve-post-gst`, null, { params: { remarks } }),
  approvePostFinance: (id, remarks) => api.post(`/events/${id}/approve-post-finance`, null, { params: { remarks } }),
  approve: (id, remarks) => api.post(`/events/${id}/approve`, null, { params: { remarks } }),
  reject: (id, reason) => api.post(`/events/${id}/reject`, null, { params: { reason } }),
  submitPostEvent: (id, remarks) => api.post(`/events/${id}/submit-post-event`, null, { params: { remarks } }),
  addDoctor: (eventId, data) => api.post(`/events/${eventId}/doctors`, data),
  updateDoctor: (eventId, doctorId, data) => api.put(`/events/${eventId}/doctors/${doctorId}`, data),
  listDoctors: (eventId) => api.get(`/events/${eventId}/doctors`),
  removeDoctor: (eventId, doctorId) => api.delete(`/events/${eventId}/doctors/${doctorId}`),
  addCost: (eventId, data) => api.post(`/events/${eventId}/costs`, data),
  listCosts: (eventId) => api.get(`/events/${eventId}/costs`),
  listMeals: (eventId) => api.get(`/events/${eventId}/meals`),
  addMeal: (eventId, data) => api.post(`/events/${eventId}/meals`, null, { params: data }),
  removeMeal: (eventId, mealId) => api.delete(`/events/${eventId}/meals/${mealId}`),
  uploadDocument: (eventId, formData) =>
    api.post(`/events/${eventId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  agreementsStatus: (eventId) => api.get(`/events/${eventId}/agreements-status`),
  generateAgreement: (eventId, doctorId) => api.post(`/events/${eventId}/generate-agreement/${doctorId}`),
  syncAgreementStatuses: (eventId) => api.post(`/events/${eventId}/agreements/sync-status`),
  agreementApiLogs: (eventId) => api.get(`/events/${eventId}/agreements/api-logs`),
  downloadAgreement: (eventId, doctorId) => api.get(`/events/${eventId}/agreements/${doctorId}/download`, { responseType: 'blob' }),
  agreementDocLogs: (eventId, doctorId) => api.get(`/events/${eventId}/agreements/${doctorId}/document-logs`),
}



// Access Management
export const accessApi = {
  listDivisions: () => api.get('/access/divisions'),
  listMyDivisions: () => api.get('/access/divisions/my'),
  createDivision: (name, code) => api.post('/access/divisions', null, { params: { name, code } }),
  // Hierarchy
  myChain: () => api.get('/access/hierarchy/my-chain'),
  myTeam: () => api.get('/access/hierarchy/team'),
  fullHierarchy: () => api.get('/access/hierarchy/full'),
  userChain: (employeeId) => api.get(`/access/hierarchy/user/${employeeId}`),
  hierarchyTree: (rootEmployeeId, depth = 3) => api.get('/access/hierarchy/tree', { params: { root_employee_id: rootEmployeeId, depth } }),
  searchEmployees: (q, limit = 20) => api.get('/access/hierarchy/search', { params: { q, limit } }),
  subordinatesByRole: (role) => api.get('/access/hierarchy/subordinates-by-role', { params: { role } }),
  allSubordinates: () => api.get('/access/hierarchy/all-subordinates'),
}



// Master Data
export const masterApi = {
  eventTypes: () => api.get('/master/event-types'),
  eventTypesAll: () => api.get('/master/event-types', { params: { all: true } }),
  createEventType: (data) => api.post('/master/event-types', null, { params: data }),
  updateEventType: (id, data) => api.put(`/master/event-types/${id}`, null, { params: data }),
  deleteEventType: (id) => api.delete(`/master/event-types/${id}`),
  documentTypes: () => api.get('/master/document-types'),
  documentTypesFull: () => api.get('/master/document-types-full'),
  documentTypesForEvent: (event_type_code, stage) => api.get('/master/document-types-for-event', { params: { event_type_code, stage } }),
  createDocumentType: (data) => api.post('/master/document-types', null, { params: data }),
  updateDocumentType: (id, data) => api.put(`/master/document-types/${id}`, null, { params: data }),
  deleteDocumentType: (id) => api.delete(`/master/document-types/${id}`),
  designations: () => api.get('/master/designations'),
  companyCodes: () => api.get('/master/company-codes'),
  enumerations: (category) => api.get(`/master/enumerations/${category}`),
  divisions: () => api.get('/master/divisions'),
  hcpDoctors: (q, limit = 50) => api.get('/master/hcp-doctors', { params: { q, limit } }),
  hcpDoctorsAll: (params) => api.get('/master/hcp-doctors-all', { params }),
  hcpDoctor: (id) => api.get(`/master/hcp-doctors/${id}`),
  createHcpDoctor: (data) => api.post('/master/hcp-doctors', null, { params: data }),
  updateHcpDoctor: (id, data) => api.put(`/master/hcp-doctors/${id}`, null, { params: data }),
  deleteHcpDoctor: (id) => api.delete(`/master/hcp-doctors/${id}`),
  fmvCriteria: () => api.get('/master/fmv-criteria'),
  fmvParameters: () => api.get('/master/fmv-parameters'),
  createFmvParameter: (data) => api.post('/master/fmv-parameters', null, { params: data }),
  updateFmvParameter: (id, data) => api.put(`/master/fmv-parameters/${id}`, null, { params: data }),
  deleteFmvParameter: (id) => api.delete(`/master/fmv-parameters/${id}`),
  specialities: () => api.get('/master/specialities'),
  createSpeciality: (name) => api.post('/master/specialities', null, { params: { name } }),
  updateSpeciality: (id, data) => api.put(`/master/specialities/${id}`, null, { params: data }),
  deleteSpeciality: (id) => api.delete(`/master/specialities/${id}`),
  hcpRoles: () => api.get('/master/hcp-roles'),
  createHcpRole: (name) => api.post('/master/hcp-roles', null, { params: { name } }),
  updateHcpRole: (id, data) => api.put(`/master/hcp-roles/${id}`, null, { params: data }),
  deleteHcpRole: (id) => api.delete(`/master/hcp-roles/${id}`),
  therapeutics: () => api.get('/master/therapeutics'),
  createTherapeutic: (name) => api.post('/master/therapeutics', null, { params: { name } }),
  updateTherapeutic: (id, data) => api.put(`/master/therapeutics/${id}`, null, { params: data }),
  deleteTherapeutic: (id) => api.delete(`/master/therapeutics/${id}`),
  states: () => api.get('/master/states'),
  createState: (name) => api.post('/master/states', null, { params: { name } }),
  updateState: (id, data) => api.put(`/master/states/${id}`, null, { params: data }),
  deleteState: (id) => api.delete(`/master/states/${id}`),
  brands: (q) => api.get('/master/brands', { params: { q } }),
  createBrand: (data) => api.post('/master/brands', null, { params: data }),
  updateBrand: (id, data) => api.put(`/master/brands/${id}`, null, { params: data }),
  meals: () => api.get('/master/meals'),
  createMeal: (data) => api.post('/master/meals', null, { params: data }),
  updateMeal: (id, data) => api.put(`/master/meals/${id}`, null, { params: data }),
  deleteMeal: (id) => api.delete(`/master/meals/${id}`),
  cities: (q, state) => api.get('/master/cities', { params: { q, state } }),
  createCity: (data) => api.post('/master/cities', null, { params: data }),
  updateCity: (id, data) => api.put(`/master/cities/${id}`, null, { params: data }),
  sponsorshipTypes: () => api.get('/master/sponsorship-types'),
  createSponsorshipType: (data) => api.post('/master/sponsorship-types', null, { params: data }),
  updateSponsorshipType: (id, data) => api.put(`/master/sponsorship-types/${id}`, null, { params: data }),
  // Entities
  entities: () => api.get('/master/entities'),
  createEntity: (data) => api.post('/master/entities', null, { params: data }),
  updateEntity: (id, data) => api.put(`/master/entities/${id}`, null, { params: data }),
  deleteEntity: (id) => api.delete(`/master/entities/${id}`),
  // Divisions CRUD
  createDivision: (data) => api.post('/master/divisions', null, { params: data }),
  updateDivision: (id, data) => api.put(`/master/divisions/${id}`, null, { params: data }),
  deleteDivision: (id) => api.delete(`/master/divisions/${id}`),
  // Budgets (Event)
  budgets: (params) => api.get('/budget/events', { params }),
  createBudget: (data) => api.post('/budget/events', null, { params: data }),
  updateBudget: (id, data) => api.put(`/budget/events/${id}`, null, { params: data }),
  deleteBudget: (id) => api.delete(`/budget/events/${id}`),
  budgetAuditTrail: (budgetId) => api.get(`/budget/events/${budgetId}/audit-trail`),
}

// BRS Module
export const brsApi = {
  dashboard: () => api.get('/brs/dashboard'),
  list: (params) => api.get('/brs/', { params }),
  create: (data) => api.post('/brs/', data),
  get: (id) => api.get(`/brs/${id}`),
  submit: (id) => api.post(`/brs/${id}/submit`),
  approve: (id, remarks) => api.post(`/brs/${id}/approve`, null, { params: { remarks } }),
  reject: (id, reason) => api.post(`/brs/${id}/reject`, null, { params: { reason } }),
  checkBudget: (division_id, start_date) => api.get('/brs/check-budget', { params: { division_id, start_date } }),
  // Doctors within BRS
  addDoctor: (appId, data) => api.post(`/brs/${appId}/doctors`, data),
  updateDoctor: (appId, doctorId, data) => api.put(`/brs/${appId}/doctors/${doctorId}`, data),
  removeDoctor: (appId, doctorId) => api.delete(`/brs/${appId}/doctors/${doctorId}`),
  getDoctorAgreement: (doctorId) => api.get(`/brs/doctors/${doctorId}/agreement`),
  // Survey Builder
  listSurveys: (params) => api.get('/brs/surveys', { params }),
  createSurvey: (data) => api.post('/brs/surveys', null, { params: data }),
  getSurvey: (id) => api.get(`/brs/surveys/${id}`),
  updateSurvey: (id, data) => api.put(`/brs/surveys/${id}`, null, { params: data }),
  uploadSurveyApproval: (surveyId, documentType, file) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    return api.post(`/brs/surveys/${surveyId}/upload-approval`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeSurveyApproval: (surveyId, documentType) =>
    api.delete(`/brs/surveys/${surveyId}/approval-document/${documentType}`),
  addQuestion: (surveyId, data) => {
    const params = { question_text: data.question_text, question_type: data.question_type, is_required: data.is_required, min_duration_seconds: data.min_duration_seconds, video_url: data.video_url }
    const url = new URL(`http://x/brs/surveys/${surveyId}/questions`)
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
    if (data.options?.length) data.options.forEach(o => url.searchParams.append('options', o))
    return api.post(`/brs/surveys/${surveyId}/questions?${url.searchParams.toString()}`)
  },
  deleteQuestion: (surveyId, questionId) => api.delete(`/brs/surveys/${surveyId}/questions/${questionId}`),
  // Doctor Portal (public)
  doctorLogin: (login_id, password) => api.post('/brs/doctor-login', { login_id, password }),
  doctorSendOtp: (token) => api.post(`/brs/doctor-portal/${token}/send-otp`),
  doctorVerifyOtp: (token, otp) => api.post(`/brs/doctor-portal/${token}/verify-otp`, { otp }),
  doctorOtpStatus: (token) => api.get(`/brs/doctor-portal/${token}/otp-status`),
  doctorPortalGet: (token) => api.get(`/brs/doctor-portal/${token}`),
  doctorUpdateDetails: (token, data) => api.post(`/brs/doctor-portal/${token}/update-details`, data),
  doctorSignAgreement: (token, signature) => api.post(`/brs/doctor-portal/${token}/sign-agreement`, null, { params: { signature } }),
  doctorSubmitSurvey: (token, data) => api.post(`/brs/doctor-portal/${token}/submit-survey`, data),
  doctorUploadDocument: (token, formData) => api.post(`/brs/doctor-portal/${token}/upload-document`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  doctorListDocuments: (token) => api.get(`/brs/doctor-portal/${token}/documents`),
  doctorDeleteDocument: (token, docId) => api.delete(`/brs/doctor-portal/${token}/documents/${docId}`),
  // Application Documents (initiator uploads after completion)
  listAppDocuments: (appId) => api.get(`/brs/${appId}/documents`),
  uploadAppDocument: (appId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/brs/${appId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteAppDocument: (appId, docId) => api.delete(`/brs/${appId}/documents/${docId}`),
}

// Event Agreements (nested under events)
export const eventAgreementsApi = {
  list: (eventId) => api.get(`/events/${eventId}/agreements`),
  create: (eventId, data) => api.post(`/events/${eventId}/agreements`, data),
  updateStatus: (eventId, agreementId, status, remark) =>
    api.put(`/events/${eventId}/agreements/${agreementId}/status`, null, { params: { status, remark } }),
  delete: (eventId, agreementId) => api.delete(`/events/${eventId}/agreements/${agreementId}`),
}

// Reports
export const reportsApi = {
  eventReport: (params) => api.get('/reports/events', { params }),
  cmeEventReport: (params) => api.get('/reports/cme-events', { params }),
  fmvParameterReport: (params) => api.get('/reports/fmv-parameters', { params }),
}

// Vendor Module
export const vendorApi = {
  // Vendors
  vendors: (q, page, page_size) => api.get('/vendor/vendors', { params: { q, page, page_size } }),
  vendor: (id) => api.get(`/vendor/vendors/${id}`),
  importVendors: () => api.post('/vendor/vendors/import'),
  updateVendor: (id, data) => api.put(`/vendor/vendors/${id}`, null, { params: data }),
  deleteVendor: (id) => api.delete(`/vendor/vendors/${id}`),
  addWithholdingTax: (vendorId, data) => api.post(`/vendor/vendors/${vendorId}/withholding-taxes`, null, { params: data }),
  removeWithholdingTax: (vendorId, taxId) => api.delete(`/vendor/vendors/${vendorId}/withholding-taxes/${taxId}`),
  setVendorWithholdingTaxes: (vendorId, ids) => api.put(`/vendor/vendors/${vendorId}/withholding-taxes`, null, { params: { withholding_tax_ids: ids } }),
  // GL Accounts (parent)
  glAccounts: () => api.get('/vendor/gl-accounts'),
  createGlAccount: (data) => api.post('/vendor/gl-accounts', null, { params: data }),
  deleteGlAccount: (id) => api.delete(`/vendor/gl-accounts/${id}`),
  // Type of Services (child of GL Account)
  typeOfServices: (gl_account_id) => api.get('/vendor/type-of-services', { params: { gl_account_id } }),
  createTypeOfService: (data) => api.post('/vendor/type-of-services', null, { params: data }),
  updateTypeOfService: (id, data) => api.put(`/vendor/type-of-services/${id}`, null, { params: data }),
  deleteTypeOfService: (id) => api.delete(`/vendor/type-of-services/${id}`),
  // Order Numbers (child of Type of Service)
  orderNumbers: (type_of_service_id) => api.get('/vendor/order-numbers', { params: { type_of_service_id } }),
  createOrderNumber: (data) => api.post('/vendor/order-numbers', null, { params: data }),
  updateOrderNumber: (id, data) => api.put(`/vendor/order-numbers/${id}`, null, { params: data }),
  deleteOrderNumber: (id) => api.delete(`/vendor/order-numbers/${id}`),
  // Withholding Tax (standalone)
  withholdingTaxes: () => api.get('/vendor/withholding-taxes'),
  createWithholdingTax: (data) => api.post('/vendor/withholding-taxes', null, { params: data }),
  updateWithholdingTax: (id, data) => api.put(`/vendor/withholding-taxes/${id}`, null, { params: data }),
  deleteWithholdingTax: (id) => api.delete(`/vendor/withholding-taxes/${id}`),
  // HSN/SAC Codes
  hsnSacCodes: () => api.get('/vendor/hsn-sac-codes'),
  createHsnSacCode: (data) => api.post('/vendor/hsn-sac-codes', null, { params: data }),
  updateHsnSacCode: (id, data) => api.put(`/vendor/hsn-sac-codes/${id}`, null, { params: data }),
  deleteHsnSacCode: (id) => api.delete(`/vendor/hsn-sac-codes/${id}`),
  // Business Places
  businessPlaces: () => api.get('/vendor/business-places'),
  createBusinessPlace: (name) => api.post('/vendor/business-places', null, { params: { name } }),
  updateBusinessPlace: (id, data) => api.put(`/vendor/business-places/${id}`, null, { params: data }),
  deleteBusinessPlace: (id) => api.delete(`/vendor/business-places/${id}`),
  // Business Areas
  businessAreas: () => api.get('/vendor/business-areas'),
  createBusinessArea: (name) => api.post('/vendor/business-areas', null, { params: { name } }),
  updateBusinessArea: (id, data) => api.put(`/vendor/business-areas/${id}`, null, { params: data }),
  deleteBusinessArea: (id) => api.delete(`/vendor/business-areas/${id}`),
  // Tax Codes
  taxCodes: () => api.get('/vendor/tax-codes'),
  createTaxCode: (code) => api.post('/vendor/tax-codes', null, { params: { code } }),
  updateTaxCode: (id, data) => api.put(`/vendor/tax-codes/${id}`, null, { params: data }),
  deleteTaxCode: (id) => api.delete(`/vendor/tax-codes/${id}`),
  // HANSA Codes
  hansaCodes: () => api.get('/vendor/hansa-codes'),
  createHansaCode: (code) => api.post('/vendor/hansa-codes', null, { params: { code } }),
  updateHansaCode: (id, data) => api.put(`/vendor/hansa-codes/${id}`, null, { params: data }),
  deleteHansaCode: (id) => api.delete(`/vendor/hansa-codes/${id}`),
}
