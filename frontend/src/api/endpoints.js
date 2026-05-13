import api from './client'

// Auth
export const authApi = {
  login: (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  },
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (old_password, new_password) =>
    api.post('/auth/change-password', null, { params: { old_password, new_password } }),
  listUsers: (params) => api.get('/auth/users', { params }),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  getUserRoles: (id) => api.get(`/auth/users/${id}/roles`),
  assignUserRole: (id, role) => api.post(`/auth/users/${id}/roles`, null, { params: { role } }),
  removeUserRole: (id, role) => api.delete(`/auth/users/${id}/roles/${role}`),
}

// Events
export const eventsApi = {
  list: (params) => api.get('/events/', { params }),
  create: (data) => api.post('/events/', data),
  get: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  submit: (id) => api.post(`/events/${id}/submit`),
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
  submitPostEvent: (id) => api.post(`/events/${id}/submit-post-event`),
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
}

// Vendors
export const vendorsApi = {
  list: (params) => api.get('/vendors/', { params }),
  create: (data) => api.post('/vendors/', data),
  get: (id) => api.get(`/vendors/${id}`),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  addBankDetail: (id, data) => api.post(`/vendors/${id}/bank-details`, data),
}

// Invoices / Approvals
export const invoicesApi = {
  list: (params) => api.get('/invoices/', { params }),
  create: (data) => api.post('/invoices/', data),
  get: (id) => api.get(`/invoices/${id}`),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  approve: (id, data) => api.post(`/invoices/${id}/approve`, data),
  postToSap: (id) => api.post(`/invoices/${id}/post-to-sap`),
}

// Agreements
export const agreementsApi = {
  list: (params) => api.get('/agreements/', { params }),
  create: (data) => api.post('/agreements/', data),
  get: (id) => api.get(`/agreements/${id}`),
  update: (id, data) => api.put(`/agreements/${id}`, data),
  approve: (id) => api.post(`/agreements/${id}/approve`),
}

// Reports
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  events: (params) => api.get('/reports/events', { params }),
  financeAllocation: (params) => api.get('/reports/finance-allocation', { params }),
  auditTrail: (params) => api.get('/reports/audit-trail', { params }),
  cmeEvents: (params) => api.get('/reports/cme-events', { params }),
  divisionWise: (params) => api.get('/reports/division-wise', { params }),
  hcpHonorarium: (params) => api.get('/reports/hcp-honorarium', { params }),
  stateWise: (params) => api.get('/reports/state-wise', { params }),
  eventTypeWise: (params) => api.get('/reports/event-type-wise', { params }),
}

// Access Management
export const accessApi = {
  listDivisions: () => api.get('/access/divisions'),
  createDivision: (name, code) => api.post('/access/divisions', null, { params: { name, code } }),
  listCostCenters: (division_id) => api.get('/access/cost-centers', { params: { division_id } }),
  createCostCenter: (data) => api.post('/access/cost-centers', null, { params: data }),
  listFunctions: () => api.get('/access/functions'),
  // Hierarchy
  myChain: () => api.get('/access/hierarchy/my-chain'),
  myTeam: () => api.get('/access/hierarchy/team'),
  userChain: (employeeId) => api.get(`/access/hierarchy/user/${employeeId}`),
  hierarchyTree: (rootEmployeeId, depth = 3) => api.get('/access/hierarchy/tree', { params: { root_employee_id: rootEmployeeId, depth } }),
  searchEmployees: (q, limit = 20) => api.get('/access/hierarchy/search', { params: { q, limit } }),
}

// Promotional
export const promotionalApi = {
  list: (params) => api.get('/promotional/', { params }),
  create: (data) => api.post('/promotional/', data),
  get: (id) => api.get(`/promotional/${id}`),
  update: (id, data) => api.put(`/promotional/${id}`, data),
  approve: (id, remarks) => api.post(`/promotional/${id}/approve`, null, { params: { remarks } }),
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
  // Doctors within BRS
  addDoctor: (appId, data) => api.post(`/brs/${appId}/doctors`, data),
  updateDoctor: (appId, doctorId, data) => api.put(`/brs/${appId}/doctors/${doctorId}`, data),
  removeDoctor: (appId, doctorId) => api.delete(`/brs/${appId}/doctors/${doctorId}`),
  getDoctorAgreement: (doctorId) => api.get(`/brs/doctors/${doctorId}/agreement`),
  // Survey Builder
  listSurveys: () => api.get('/brs/surveys'),
  createSurvey: (data) => api.post('/brs/surveys', null, { params: data }),
  getSurvey: (id) => api.get(`/brs/surveys/${id}`),
  updateSurvey: (id, data) => api.put(`/brs/surveys/${id}`, null, { params: data }),
  addQuestion: (surveyId, data) => {
    const params = { question_text: data.question_text, question_type: data.question_type, is_required: data.is_required, min_duration_seconds: data.min_duration_seconds, video_url: data.video_url }
    const url = new URL(`http://x/brs/surveys/${surveyId}/questions`)
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
    if (data.options?.length) data.options.forEach(o => url.searchParams.append('options', o))
    return api.post(`/brs/surveys/${surveyId}/questions?${url.searchParams.toString()}`)
  },
  deleteQuestion: (surveyId, questionId) => api.delete(`/brs/surveys/${surveyId}/questions/${questionId}`),
  // Doctor Portal (public)
  doctorLogin: (login_id, password) => api.post('/brs/doctor-login', null, { params: { login_id, password } }),
  doctorPortalGet: (token) => api.get(`/brs/doctor-portal/${token}`),
  doctorUpdateDetails: (token, data) => api.post(`/brs/doctor-portal/${token}/update-details`, data),
  doctorSignAgreement: (token, signature) => api.post(`/brs/doctor-portal/${token}/sign-agreement`, null, { params: { signature } }),
  doctorSubmitSurvey: (token, data) => api.post(`/brs/doctor-portal/${token}/submit-survey`, data),
  doctorUploadDocument: (token, formData) => api.post(`/brs/doctor-portal/${token}/upload-document`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  doctorListDocuments: (token) => api.get(`/brs/doctor-portal/${token}/documents`),
  doctorDeleteDocument: (token, docId) => api.delete(`/brs/doctor-portal/${token}/documents/${docId}`),
}

// Event Agreements (nested under events)
export const eventAgreementsApi = {
  list: (eventId) => api.get(`/events/${eventId}/agreements`),
  create: (eventId, data) => api.post(`/events/${eventId}/agreements`, data),
  updateStatus: (eventId, agreementId, status, remark) =>
    api.put(`/events/${eventId}/agreements/${agreementId}/status`, null, { params: { status, remark } }),
  delete: (eventId, agreementId) => api.delete(`/events/${eventId}/agreements/${agreementId}`),
}
