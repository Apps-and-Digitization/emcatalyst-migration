import { useState, useEffect } from 'react'
import { GitBranch, Plus, Trash2, Save, GripVertical } from 'lucide-react'
import api from '../../api/client'
import toast from 'react-hot-toast'

const APPROVER_TYPES = [
  { value: 'reporting_manager', label: 'Reporting Manager (L1/L2)' },
  { value: 'role', label: 'Role-based' },
  { value: 'specific_user', label: 'Specific User' },
]

export default function WorkflowConfig() {
  const [workflows, setWorkflows] = useState([])
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [selectedWfId, setSelectedWfId] = useState(null)
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [wfRes, rolesRes, usersRes] = await Promise.all([
        api.get('/workflows/'),
        api.get('/rbac/roles'),
        api.get('/auth/users'),
      ])
      setWorkflows(wfRes.data)
      setRoles(rolesRes.data)
      setUsers(usersRes.data)
      if (wfRes.data.length > 0 && !selectedWfId) {
        setSelectedWfId(wfRes.data[0].id)
        setSteps(wfRes.data[0].steps || [])
      }
    } catch (err) {
      toast.error('Failed to load workflow data')
    } finally {
      setLoading(false)
    }
  }

  const selectWorkflow = (wf) => {
    setSelectedWfId(wf.id)
    setSteps(wf.steps || [])
  }

  const addStep = () => {
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) : 0
    setSteps([...steps, {
      step_order: maxOrder + 1,
      step_label: '',
      approver_type: 'role',
      approver_role_id: null,
      approver_user_id: null,
      manager_level: 1,
      pending_status: '',
      approved_status: '',
      can_skip: false,
      is_active: true,
    }])
  }

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const updateStep = (index, field, value) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const moveStep = (index, direction) => {
    const newSteps = [...steps]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newSteps.length) return
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    // Recalculate step_order
    newSteps.forEach((s, i) => { s.step_order = i + 1 })
    setSteps(newSteps)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        steps: steps.map((s, i) => ({
          step_order: i + 1,
          step_label: s.step_label,
          approver_type: s.approver_type,
          approver_role_id: s.approver_type === 'role' ? s.approver_role_id : null,
          approver_user_id: s.approver_type === 'specific_user' ? s.approver_user_id : null,
          manager_level: s.approver_type === 'reporting_manager' ? (s.manager_level || 1) : null,
          pending_status: s.pending_status || null,
          approved_status: s.approved_status || null,
          can_skip: s.can_skip || false,
        }))
      }
      await api.put(`/workflows/${selectedWfId}/steps`, payload)
      toast.success('Workflow saved')
      await fetchData()
    } catch (err) {
      toast.error('Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const selectedWf = workflows.find(w => w.id === selectedWfId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <GitBranch className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel — Workflows */}
        <div className="col-span-3">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Workflows</h2>
            <div className="space-y-1">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => selectWorkflow(wf)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedWfId === wf.id
                      ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{wf.workflow_label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{wf.steps?.length || 0} steps</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — Steps editor */}
        <div className="col-span-9">
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700">
                  {selectedWf?.workflow_label}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedWf?.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Initiator Role:</label>
                  <select
                    className="text-sm border rounded px-2 py-1 w-40"
                    value={selectedWf?.initiator_role_id || ''}
                    onChange={async (e) => {
                      const roleId = e.target.value ? parseInt(e.target.value) : 0
                      try {
                        await api.put(`/workflows/${selectedWfId}`, { initiator_role_id: roleId })
                        toast.success('Initiator role updated')
                        await fetchData()
                      } catch (err) { toast.error('Failed to update') }
                    }}
                  >
                    <option value="">Anyone</option>
                    {roles.filter(r => r.is_active).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addStep}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {steps.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No steps configured. Click "Add Step" to begin.
                </div>
              ) : (
                steps.map((step, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveStep(index, -1)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                        >▲</button>
                        <button
                          onClick={() => moveStep(index, 1)}
                          disabled={index === steps.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                        >▼</button>
                      </div>
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={step.step_label}
                        onChange={(e) => updateStep(index, 'step_label', e.target.value)}
                        placeholder="Step label (e.g. L1 Manager)"
                        className="flex-1 text-sm border rounded px-2 py-1"
                      />
                      <button
                        onClick={() => removeStep(index)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Approver Type</label>
                        <select
                          value={step.approver_type}
                          onChange={(e) => updateStep(index, 'approver_type', e.target.value)}
                          className="w-full text-sm border rounded px-2 py-1"
                        >
                          {APPROVER_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {step.approver_type === 'role' && (
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Role</label>
                          <select
                            value={step.approver_role_id || ''}
                            onChange={(e) => updateStep(index, 'approver_role_id', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full text-sm border rounded px-2 py-1"
                          >
                            <option value="">Select role...</option>
                            {roles.filter(r => r.is_active).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {step.approver_type === 'reporting_manager' && (
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Manager Level</label>
                          <select
                            value={step.manager_level || 1}
                            onChange={(e) => updateStep(index, 'manager_level', parseInt(e.target.value))}
                            className="w-full text-sm border rounded px-2 py-1"
                          >
                            <option value={1}>L1 (Direct Manager)</option>
                            <option value={2}>L2 (Manager's Manager)</option>
                            <option value={3}>L3</option>
                          </select>
                        </div>
                      )}

                      {step.approver_type === 'specific_user' && (
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">User</label>
                          <select
                            value={step.approver_user_id || ''}
                            onChange={(e) => updateStep(index, 'approver_user_id', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full text-sm border rounded px-2 py-1"
                          >
                            <option value="">Select user...</option>
                            {users.slice(0, 200).map(u => (
                              <option key={u.id} value={u.id}>
                                {[u.first_name, u.last_name].filter(Boolean).join(' ')} ({u.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Pending Status</label>
                        <input
                          type="text"
                          value={step.pending_status || ''}
                          onChange={(e) => updateStep(index, 'pending_status', e.target.value)}
                          placeholder="e.g. Pending L1"
                          className="w-full text-sm border rounded px-2 py-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Approved Status</label>
                        <input
                          type="text"
                          value={step.approved_status || ''}
                          onChange={(e) => updateStep(index, 'approved_status', e.target.value)}
                          placeholder="e.g. Pending L2"
                          className="w-full text-sm border rounded px-2 py-1"
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.can_skip || false}
                          onChange={(e) => updateStep(index, 'can_skip', e.target.checked)}
                        />
                        Can be skipped (auto-skip if approver not available)
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
