import { create } from 'zustand'
import api from '../api/client'

const useJobStore = create((set, get) => ({
  jobs: [],
  polling: false,
  pollInterval: null,

  // Start tracking a job
  addJob: (jobId) => {
    const { jobs, startPolling } = get()
    if (!jobs.find(j => j.id === jobId)) {
      set({ jobs: [...jobs, { id: jobId, status: 'pending', progress: 0, total: 0, message: 'Starting...' }] })
    }
    startPolling()
  },

  // Fetch latest status for all active jobs
  pollJobs: async () => {
    const { jobs } = get()
    const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'running')
    if (activeJobs.length === 0) {
      get().stopPolling()
      return
    }

    const updatedJobs = [...jobs]
    for (const job of activeJobs) {
      try {
        const res = await api.get(`/jobs/${job.id}`)
        const idx = updatedJobs.findIndex(j => j.id === job.id)
        if (idx >= 0) {
          updatedJobs[idx] = res.data
        }
      } catch {
        // ignore poll errors
      }
    }
    set({ jobs: updatedJobs })

    // Stop polling if no more active jobs
    const stillActive = updatedJobs.filter(j => j.status === 'pending' || j.status === 'running')
    if (stillActive.length === 0) {
      get().stopPolling()
    }
  },

  startPolling: () => {
    const { polling, pollJobs } = get()
    if (polling) return
    const interval = setInterval(pollJobs, 2000)
    set({ polling: true, pollInterval: interval })
    // Immediate first poll
    pollJobs()
  },

  stopPolling: () => {
    const { pollInterval } = get()
    if (pollInterval) {
      clearInterval(pollInterval)
    }
    set({ polling: false, pollInterval: null })
  },

  // Remove a completed/failed job from the panel
  dismissJob: (jobId) => {
    set({ jobs: get().jobs.filter(j => j.id !== jobId) })
  },

  // Clear all completed jobs
  clearCompleted: () => {
    set({ jobs: get().jobs.filter(j => j.status === 'pending' || j.status === 'running') })
  },
}))

export default useJobStore
