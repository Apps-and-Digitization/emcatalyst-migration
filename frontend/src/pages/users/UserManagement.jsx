import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi, masterApi } from '../../api/endpoints'
import api from '../../api/client'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'

const PAGE_SIZE = 50

export default function UserManagement() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [newUserModal, setNewUserModal] = useState(false)
  const [editRoleModal, setEditRoleModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editRoles, setEditRoles] = useState([])
  const [editManagerId, setEditManagerId] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editDivisions, setEditDivisions] = useState([])
  const [managerSearch, setManagerSearch] = useState('')
  const { register, handleSubmit, reset } = useForm()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers().then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const { data: rbacRoles = [] } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles/list').then(r => r.data),
  })

  // All roles come from RBAC — used for both primary and additional
  const ALL_ROLES = rbacRoles.map(r => r.name)

  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]))

  const createUser = useMutation({
    mutationFn: (data) => authApi.createUser(data),
    onSuccess: () => { qc.invalidateQueries(['users']); setNewUserModal(false); reset(); toast.success('User created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error creating user'),
  })

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => authApi.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries(['users']); setEditRoleModal(false); toast.success('User updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const filtered = users.filter(u =>
    !search || `${u.first_name} ${u.last_name} ${u.email} ${u.employee_id || ''} ${u.department || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearchChange = (val) => {
    setSearch(val)
    setPage(1)
  }

  const openEditRole = (u) => {
    setEditUser(u)
    setEditRole(u.role)
    setEditRoles(u.roles || [])
    setEditManagerId(u.manager_id || '')
    setEditEmployeeId(u.employee_id || '')
    setEditEmail(u.email || '')
    setEditDivisions(u.divisions || [])
    setEditRoleModal(true)
  }

  // Build a list of potential managers (all users except the one being edited)
  const managerOptions = users.filter(u => !editUser || u.id !== editUser.id)

  return (
    <div className="p-8">
      <PageHeader
        title="User Management"
        subtitle={`${users.length} users · ${divisions.length} divisions`}
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={() => setNewUserModal(true)}>
            <Plus size={16} /> New User
          </button>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, email, employee ID, department…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        {filtered.length !== users.length && (
          <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
        )}
      </div>

      {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Emp ID', 'Name', 'Email', 'Division', 'Manager', 'Role', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{u.employee_id || '—'}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                      {u.designation_title && (
                        <span className="block text-xs text-gray-400">{u.designation_title}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{divisionMap[u.division_id] || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{u.manager_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{u.role}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          onClick={() => openEditRole(u)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                          onClick={() => updateUser.mutate({ id: u.id, data: { is_active: !u.is_active } })}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button
                  className="btn-secondary py-1 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                  const pg = i + 1
                  return (
                    <button
                      key={pg}
                      className={`py-1 px-2.5 rounded text-xs ${pg === page ? 'bg-blue-600 text-white' : 'btn-secondary'}`}
                      onClick={() => setPage(pg)}
                    >
                      {pg}
                    </button>
                  )
                })}
                {totalPages > 10 && <span className="text-xs text-gray-400 self-center px-1">…{totalPages}</span>}
                <button
                  className="btn-secondary py-1 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Role Modal */}
      <Modal open={editRoleModal} onClose={() => setEditRoleModal(false)} title="Edit User">
        {editUser && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {[editUser.first_name, editUser.last_name].filter(Boolean).join(' ')}
              </p>
              <p className="text-xs text-gray-500">{editUser.employee_id}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Employee ID</label>
                <input className="input" value={editEmployeeId} onChange={e => setEditEmployeeId(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Primary Role</label>
              <select className="input" value={editRole} onChange={e => setEditRole(e.target.value)}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Additional Roles (RBAC)</label>
              <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                {ALL_ROLES.map(r => (
                  <label key={r} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRoles.includes(r)}
                      onChange={e => {
                        if (e.target.checked) setEditRoles(prev => [...prev, r])
                        else setEditRoles(prev => prev.filter(x => x !== r))
                      }}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Additional roles control RBAC page access</p>
            </div>
            <div>
              <label className="label">Additional Divisions</label>
              <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                {divisions.map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDivisions.includes(d.id)}
                      disabled={d.id === editUser?.division_id}
                      onChange={e => {
                        if (e.target.checked) setEditDivisions(prev => [...prev, d.id])
                        else setEditDivisions(prev => prev.filter(x => x !== d.id))
                      }}
                    />
                    {d.name} {d.id === editUser?.division_id ? '(primary)' : ''}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Additional divisions for data access</p>
            </div>
            <div>
              <label className="label">Manager (L1 Approver)</label>
              <select
                className="input"
                value={editManagerId}
                onChange={e => setEditManagerId(e.target.value)}
              >
                <option value="">— No Manager —</option>
                {managerOptions
                  .filter(m => !managerSearch || `${m.first_name} ${m.last_name} ${m.employee_id || ''}`.toLowerCase().includes(managerSearch.toLowerCase()))
                  .slice(0, 100)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ')} {m.employee_id ? `(${m.employee_id})` : ''} {m.designation_title ? `– ${m.designation_title}` : ''}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">L2 approver will be this manager's manager automatically.</p>
            </div>
            <div>
              <label className="label">Active</label>
              <select className="input" defaultValue={editUser.is_active ? 'true' : 'false'} id="active-select">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditRoleModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={async () => {
                  // Update primary role and manager
                  await updateUser.mutateAsync({
                    id: editUser.id,
                    data: {
                      role: editRole,
                      employee_id: editEmployeeId || undefined,
                      email: editEmail || undefined,
                      manager_id: editManagerId ? parseInt(editManagerId) : null,
                      is_active: document.getElementById('active-select').value === 'true',
                    }
                  })
                  // Sync additional roles
                  const currentRoles = editUser.roles || []
                  const toAdd = editRoles.filter(r => !currentRoles.includes(r))
                  const toRemove = currentRoles.filter(r => !editRoles.includes(r))
                  for (const r of toAdd) {
                    try { await authApi.assignUserRole(editUser.id, r) } catch(e) {}
                  }
                  for (const r of toRemove) {
                    try { await authApi.removeUserRole(editUser.id, r) } catch(e) {}
                  }
                  // Sync additional divisions
                  const currentDivs = editUser.divisions || []
                  const divsToAdd = editDivisions.filter(d => !currentDivs.includes(d) && d !== editUser.division_id)
                  const divsToRemove = currentDivs.filter(d => !editDivisions.includes(d))
                  for (const d of divsToAdd) {
                    try { await authApi.assignUserDivision(editUser.id, d) } catch(e) {}
                  }
                  for (const d of divsToRemove) {
                    try { await authApi.removeUserDivision(editUser.id, d) } catch(e) {}
                  }
                  qc.invalidateQueries(['users'])
                  setEditRoleModal(false)
                  toast.success('User updated')
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New User Modal */}
      <Modal open={newUserModal} onClose={() => setNewUserModal(false)} title="New User" size="md">
        <form onSubmit={handleSubmit(async (d) => {
          const payload = { ...d }
          if (payload.manager_id) payload.manager_id = parseInt(payload.manager_id)
          else delete payload.manager_id
          if (payload.division_id) payload.division_id = parseInt(payload.division_id)
          else delete payload.division_id

          try {
            await authApi.createUser(payload)
            qc.invalidateQueries(['users'])
            setNewUserModal(false)
            reset()
            toast.success('User created')
          } catch (e) {
            toast.error(e.response?.data?.detail || 'Error creating user')
          }
        })} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First Name</label><input className="input" {...register('first_name')} /></div>
            <div><label className="label">Last Name</label><input className="input" {...register('last_name')} /></div>
            <div>
              <label className="label">Employee ID *</label>
              <input className="input" {...register('employee_id', { required: true })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...register('email')} />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" {...register('password', { required: true })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" {...register('role')}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Division</label>
              <select className="input" {...register('division_id')}>
                <option value="">None</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Manager (L1 Approver)</label>
              <select className="input" {...register('manager_id')}>
                <option value="">— No Manager —</option>
                {users.slice(0, 200).map(m => (
                  <option key={m.id} value={m.id}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ')} {m.employee_id ? `(${m.employee_id})` : ''} {m.designation_title ? `– ${m.designation_title}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">This user's direct manager. L2 is derived from the manager's own manager.</p>
            </div>
          </div>
          <div>
            <label className="label">Designation</label>
            <input className="input" {...register('designation_title')} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setNewUserModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
