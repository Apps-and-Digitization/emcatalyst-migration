import { useQuery } from '@tanstack/react-query'
import { CalendarDays, FileText, Building2, Megaphone, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import { reportsApi } from '../api/endpoints'
import { fmtCurrency } from '../utils/helpers'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import useAuthStore from '../store/authStore'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then(r => r.data),
  })

  if (isLoading) return (
    <div className="p-8">
      <LoadingSpinner />
    </div>
  )

  const d = data || {}

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name || 'User'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here's what's happening in Catalyst today.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Events"     value={d.events?.total}     icon={CalendarDays} color="bg-[var(--color-primary-50)]0" />
        <StatCard label="Pending Events"   value={d.events?.pending}   icon={Clock}        color="bg-amber-500" />
        <StatCard label="Approved Events"  value={d.events?.approved}  icon={CheckCircle}  color="bg-emerald-500" />
        <StatCard label="Pending Invoices" value={d.invoices?.pending} icon={FileText}     color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Invoices"   value={d.invoices?.total}     icon={FileText}   color="bg-[var(--color-info)]" />
        <StatCard label="Agreements"       value={d.agreements?.total}   icon={FileText}   color="bg-cyan-500" />
        <StatCard label="Promo Events"     value={d.promotional?.total}  icon={Megaphone}  color="bg-rose-500" />
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Event', href: '/events/new', color: 'bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-100)]' },
            { label: 'New Invoice', href: '/approvals/new', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { label: 'New Agreement', href: '/agreements/new', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
            { label: 'View Reports', href: '/reports', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          ].map(({ label, href, color }) => (
            <a
              key={href}
              href={href}
              className={`border rounded-lg px-4 py-3 text-sm font-medium text-center hover:opacity-80 transition-opacity ${color}`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
