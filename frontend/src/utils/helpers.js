import { format, parseISO } from 'date-fns'

export const fmtDate = (d) => {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') }
  catch { return '—' }
}

export const fmtDateTime = (d) => {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy, hh:mm a') }
  catch { return '—' }
}

export const fmtCurrency = (amount, currency = 'INR') => {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

export const statusBadgeClass = (status) => {
  const s = (status || '').toLowerCase().replace(/[\s-]+/g, '_')
  const map = {
    // Event statuses
    draft: 'badge-draft',
    submitted: 'badge-submitted',
    approved: 'badge-approved',
    pre_approved: 'badge-approved',
    rejected: 'badge-rejected',
    pending: 'badge-pending',
    pending_l1: 'badge-pending',
    pending_l2: 'badge-under-review',
    pending_compliance: 'badge-compliance',
    post_l1: 'badge-info',
    post_l2: 'badge-agreement',
    post_compliance: 'badge-compliance',
    post_coordinator: 'badge-finance',
    post_gst: 'badge-finance',
    post_finance: 'badge-finance',
    'post_event_pending': 'badge-pending',
    under_review: 'badge-under-review',
    compliance_approved: 'badge-compliance',
    finance_approved: 'badge-finance',
    completed: 'badge-completed',
    cancelled: 'badge-rejected',
    expired: 'badge-expired',
    // Invoice / Payment
    paid: 'badge-paid',
    unpaid: 'badge-pending',
    overdue: 'badge-overdue',
    // BRS statuses
    doctor_pending: 'badge-doctor-pending',
    dh_approved: 'badge-approved',
    dh_rejected: 'badge-rejected',
    // Doctor statuses
    details_updated: 'badge-info',
    agreement_signed: 'badge-agreement',
    survey_completed: 'badge-completed',
    // General
    active: 'badge-active',
    inactive: 'badge-inactive',
    // Audit actions
    created: 'badge-draft',
    updated: 'badge-info',
    deleted: 'badge-rejected',
  }
  return map[s] || 'badge-default'
}

export const getInitials = (firstName, lastName) => {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || 'U'
}
