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
}

// Events
export const eventsApi = {
  list: (params) => api.get('/events/', { params }),
  create: (data) => api.post('/events/', data),
  get: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.put(`/events/${id}`, data),
  submit: (id) => api.post(`/events/${id}/submit`),
  approve: (id, remarks) => api.post(`/events/${id}/approve`, null, { params: { remarks } }),
  reject: (id, reason) => api.post(`/events/${id}/reject`, null, { params: { reason } }),
  addDoctor: (eventId, data) => api.post(`/events/${eventId}/doctors`, data),
  listDoctors: (eventId) => api.get(`/events/${eventId}/doctors`),
  removeDoctor: (eventId, doctorId) => api.delete(`/events/${eventId}/doctors/${doctorId}`),
  addCost: (eventId, data) => api.post(`/events/${eventId}/costs`, data),
  listCosts: (eventId) => api.get(`/events/${eventId}/costs`),
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
  documentTypes: () => api.get('/master/document-types'),
  documentTypesFull: () => api.get('/master/document-types-full'),
  createDocumentType: (data) => api.post('/master/document-types', null, { params: data }),
  updateDocumentType: (id, data) => api.put(`/master/document-types/${id}`, null, { params: data }),
  designations: () => api.get('/master/designations'),
  companyCodes: () => api.get('/master/company-codes'),
  enumerations: (category) => api.get(`/master/enumerations/${category}`),
  divisions: () => api.get('/master/divisions'),
  hcpDoctors: (q, limit = 50) => api.get('/master/hcp-doctors', { params: { q, limit } }),
  hcpDoctorsAll: (params) => api.get('/master/hcp-doctors-all', { params }),
  hcpDoctor: (id) => api.get(`/master/hcp-doctors/${id}`),
  fmvCriteria: () => api.get('/master/fmv-criteria'),
  specialities: () => api.get('/master/specialities'),
  hcpRoles: () => api.get('/master/hcp-roles'),
  therapeutics: () => api.get('/master/therapeutics'),
  states: () => api.get('/master/states'),
  brands: (q) => api.get('/master/brands', { params: { q } }),
  createBrand: (data) => api.post('/master/brands', null, { params: data }),
  updateBrand: (id, data) => api.put(`/master/brands/${id}`, null, { params: data }),
  meals: () => api.get('/master/meals'),
  createMeal: (name) => api.post('/master/meals', null, { params: { name } }),
  updateMeal: (id, data) => api.put(`/master/meals/${id}`, null, { params: data }),
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
  update: (id, data) => api.put(`/brs/${id}`, data),
  submit: (id) => api.post(`/brs/${id}/submit`),
  approveL1: (id, remarks) => api.post(`/brs/${id}/approve-l1`, null, { params: { remarks } }),
  approveL2: (id, remarks) => api.post(`/brs/${id}/approve-l2`, null, { params: { remarks } }),
  approveCompliance: (id, remarks) => api.post(`/brs/${id}/approve-compliance`, null, { params: { remarks } }),
  reject: (id, reason) => api.post(`/brs/${id}/reject`, null, { params: { reason } }),
  sendSurveyLink: (id) => api.post(`/brs/${id}/send-survey-link`),
  verifyCoord: (id, remarks) => api.post(`/brs/${id}/verify-coord`, null, { params: { remarks } }),
  triggerVendorCreation: (id) => api.post(`/brs/${id}/trigger-vendor-creation`),
  markVendorCreated: (id, vendor_id) => api.post(`/brs/${id}/mark-vendor-created`, null, { params: { vendor_id } }),
  postFinance: (id, remarks) => api.post(`/brs/${id}/post-finance`, null, { params: { remarks } }),
  markPaid: (id, remarks) => api.post(`/brs/${id}/mark-paid`, null, { params: { remarks } }),
  completeSurvey: (id) => api.post(`/brs/${id}/complete-survey`),
  uploadPan: (id, formData) => api.post(`/brs/${id}/upload-pan`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Survey Builder
  listSurveys: () => api.get('/brs/surveys'),
  createSurvey: (data) => api.post('/brs/surveys', null, { params: data }),
  getSurvey: (id) => api.get(`/brs/surveys/${id}`),
  updateSurvey: (id, data) => api.put(`/brs/surveys/${id}`, null, { params: data }),
  addQuestion: (surveyId, data) => {
    const params = {
      question_text: data.question_text,
      question_type: data.question_type,
      is_required: data.is_required,
      min_duration_seconds: data.min_duration_seconds,
      video_url: data.video_url,
    }
    const url = new URL(`http://x/brs/surveys/${surveyId}/questions`)
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
    if (data.options?.length) data.options.forEach(o => url.searchParams.append('options', o))
    return api.post(`/brs/surveys/${surveyId}/questions?${url.searchParams.toString()}`)
  },
  updateQuestion: (surveyId, questionId, data) => {
    const url = new URL(`http://x/brs/surveys/${surveyId}/questions/${questionId}`)
    Object.entries(data).forEach(([k, v]) => {
      if (v != null && k !== 'options') url.searchParams.set(k, v)
    })
    if (data.options?.length) data.options.forEach(o => url.searchParams.append('options', o))
    return api.put(`/brs/surveys/${surveyId}/questions/${questionId}?${url.searchParams.toString()}`)
  },
  deleteQuestion: (surveyId, questionId) => api.delete(`/brs/surveys/${surveyId}/questions/${questionId}`),
  // Doctor Portal (public)
  portalGet: (token) => api.get(`/brs/portal/${token}`),
  portalUpdateDetails: (token, data) => api.post(`/brs/portal/${token}/update-details`, data),
  portalSendOtp: (token) => api.post(`/brs/portal/${token}/send-otp`),
  portalStartSurvey: (token) => api.post(`/brs/portal/${token}/start-survey`),
  portalSubmitSurvey: (token, data) => api.post(`/brs/portal/${token}/submit-survey`, data),
  portalSign: (token, data) => api.post(`/brs/portal/${token}/sign`, data),
}

// Event Agreements (nested under events)
export const eventAgreementsApi = {
  list: (eventId) => api.get(`/events/${eventId}/agreements`),
  create: (eventId, data) => api.post(`/events/${eventId}/agreements`, data),
  updateStatus: (eventId, agreementId, status, remark) =>
    api.put(`/events/${eventId}/agreements/${agreementId}/status`, null, { params: { status, remark } }),
  delete: (eventId, agreementId) => api.delete(`/events/${eventId}/agreements/${agreementId}`),
}
