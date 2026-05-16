import { X, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import useJobStore from '../store/jobStore'

const JOB_TYPE_LABELS = {
  vendor_import: 'Import Vendors',
  mcl_import: 'Import MCL Doctors',
  brs_bulk: 'Bulk BRS Upload',
}

export default function JobNotificationPanel() {
  const { jobs, dismissJob, clearCompleted } = useJobStore()
  const [collapsed, setCollapsed] = useState(false)

  if (jobs.length === 0) return null

  const hasCompleted = jobs.some(j => j.status === 'completed' || j.status === 'failed')
  const activeCount = jobs.filter(j => j.status === 'pending' || j.status === 'running').length

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-80">
      <div className="bg-white rounded-xl shadow-2xl border overflow-hidden">
        {/* Header — always visible */}
        <div
          className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Background Jobs</span>
            {activeCount > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{activeCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasCompleted && !collapsed && (
              <button onClick={(e) => { e.stopPropagation(); clearCompleted() }} className="text-xs text-gray-400 hover:text-gray-600">
                Clear done
              </button>
            )}
            {collapsed ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>

        {/* Jobs list — collapsible */}
        {!collapsed && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {jobs.map(job => (
              <div key={job.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {job.status === 'running' || job.status === 'pending' ? (
                      <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />
                    ) : job.status === 'completed' ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-red-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                    </span>
                  </div>
                  {(job.status === 'completed' || job.status === 'failed') && (
                    <button onClick={() => dismissJob(job.id)} className="text-gray-300 hover:text-gray-500 shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {(job.status === 'running' || job.status === 'pending') && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: job.total > 0 ? `${Math.min((job.progress / job.total) * 100, 100)}%` : '30%' }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 truncate">{job.message}</p>
                    {job.total > 0 && (
                      <p className="text-[11px] text-gray-400">{job.progress.toLocaleString()} / {job.total.toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Completed result */}
                {job.status === 'completed' && job.result && (
                  <p className="text-[11px] text-green-600 mt-1">
                    {job.result.created != null && `${job.result.created} created`}
                    {job.result.updated != null && `, ${job.result.updated} updated`}
                    {job.result.fetched != null && ` (${job.result.fetched} total)`}
                  </p>
                )}

                {/* Failed error */}
                {job.status === 'failed' && (
                  <p className="text-[11px] text-red-500 mt-1 truncate" title={job.error}>{job.error || 'Unknown error'}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
