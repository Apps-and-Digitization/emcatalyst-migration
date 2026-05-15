import { useState, useEffect, useMemo } from 'react'
import { Shield, Search, Save, Check, X } from 'lucide-react'
import api from '../../api/client'
import toast from 'react-hot-toast'

export default function RBACConfig() {
  const [roles, setRoles] = useState([])
  const [pages, setPages] = useState([])
  const [accessMatrix, setAccessMatrix] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New role form
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [rolesRes, pagesRes, accessRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/pages'),
        api.get('/rbac/access'),
      ])
      setRoles(rolesRes.data)
      setPages(pagesRes.data)
      setAccessMatrix(accessRes.data)
      if (rolesRes.data.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesRes.data[0].id)
      }
    } catch (err) {
      toast.error('Failed to load RBAC data')
    } finally {
      setLoading(false)
    }
  }

  // Get access state for a role+page combo
  const getAccess = (roleId, pageId) => {
    const entry = accessMatrix.find((e) => e.role_id === roleId && e.page_id === pageId)
    return entry ? entry.can_access : false
  }

  // Toggle access locally
  const toggleAccess = (pageId) => {
    const roleId = selectedRoleId
    setAccessMatrix((prev) => {
      const idx = prev.findIndex((e) => e.role_id === roleId && e.page_id === pageId)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], can_access: !updated[idx].can_access }
        return updated
      }
      return [...prev, { role_id: roleId, page_id: pageId, can_access: true }]
    })
  }

  // Select/deselect all for current role
  const toggleAll = (value) => {
    const roleId = selectedRoleId
    setAccessMatrix((prev) => {
      const otherEntries = prev.filter((e) => e.role_id !== roleId)
      const newEntries = pages.map((p) => ({
        role_id: roleId,
        page_id: p.id,
        can_access: value,
      }))
      return [...otherEntries, ...newEntries]
    })
  }

  // Save access matrix for selected role
  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = pages.map((p) => ({
        role_id: selectedRoleId,
        page_id: p.id,
        can_access: getAccess(selectedRoleId, p.id),
      }))
      await api.put('/rbac/access', { entries })
      toast.success('Access matrix saved')
      await fetchData()
    } catch (err) {
      toast.error('Failed to save access matrix')
    } finally {
      setSaving(false)
    }
  }

  // Create new role
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    try {
      await api.post('/rbac/roles', { name: newRoleName, description: newRoleDesc })
      toast.success('Role created')
      setNewRoleName('')
      setNewRoleDesc('')
      setShowNewRole(false)
      await fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create role')
    }
  }

  // Filtered pages
  const filteredPages = useMemo(() => {
    if (!search) return pages
    const q = search.toLowerCase()
    return pages.filter(
      (p) =>
        p.page_label.toLowerCase().includes(q) ||
        p.page_key.toLowerCase().includes(q) ||
        (p.nav_group || '').toLowerCase().includes(q)
    )
  }, [pages, search])

  // Count access per role
  const accessCount = (roleId) => {
    return accessMatrix.filter((e) => e.role_id === roleId && e.can_access).length
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId)
  const isAdmin = selectedRole?.name === 'Administrator'

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
        <Shield className="w-6 h-6 text-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold text-gray-900">Role-Based Access Control</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel — Roles */}
        <div className="col-span-3">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Roles</h2>
              <button
                onClick={() => setShowNewRole(!showNewRole)}
                className="btn-primary"
              >
                + New
              </button>
            </div>

            {showNewRole && (
              <div className="mb-3 p-2 bg-gray-50 rounded border space-y-2">
                <input
                  type="text"
                  placeholder="Role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1"
                />
                <button
                  onClick={handleCreateRole}
                  className="btn-primary"
                >
                  Create
                </button>
              </div>
            )}

            <div className="space-y-1">
              {roles.filter(r => r.is_active).map((role) => (
                <div
                  key={role.id}
                  className={`flex items-center gap-1 rounded text-sm transition-colors ${
                    selectedRoleId === role.id
                      ? 'bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex-1 text-left px-3 py-2 ${
                      selectedRoleId === role.id
                        ? 'text-[var(--color-primary)] font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{role.name}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {accessCount(role.id)}
                      </span>
                    </div>
                  </button>
                  {role.name !== 'Administrator' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm(`Disable role "${role.name}"? It will be hidden from dropdowns.`)) return
                        try {
                          await api.delete(`/rbac/roles/${role.id}`)
                          toast.success(`Role "${role.name}" disabled`)
                          await fetchData()
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Failed to disable role')
                        }
                      }}
                      className="px-2 py-1 text-red-400 hover:text-red-600 shrink-0"
                      title="Disable role"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Disabled roles */}
            {roles.filter(r => !r.is_active).length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-gray-400 uppercase mb-2">Disabled Roles</p>
                <div className="space-y-1">
                  {roles.filter(r => !r.is_active).map(role => (
                    <div key={role.id} className="flex items-center justify-between px-3 py-1.5 rounded bg-gray-50 text-sm text-gray-400">
                      <span className="line-through">{role.name}</span>
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/rbac/roles/${role.id}/reactivate`)
                            toast.success(`Role "${role.name}" re-enabled`)
                            await fetchData()
                          } catch (err) {
                            toast.error(err.response?.data?.detail || 'Failed to re-enable role')
                          }
                        }}
                        className="text-xs text-emerald-500 hover:text-emerald-700 font-medium"
                      >
                        Enable
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Pages matrix */}
        <div className="col-span-9">
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-gray-700">
                  Pages for: <span className="text-[var(--color-primary)]">{selectedRole?.name}</span>
                </h2>
                {isAdmin && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                    Admin always has full access
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border rounded-lg w-48"
                  />
                </div>
                {!isAdmin && (
                  <>
                    <button
                      onClick={() => toggleAll(true)}
                      className="text-xs px-2 py-1 border rounded hover:bg-green-50 text-green-700"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      className="text-xs px-2 py-1 border rounded hover:bg-red-50 text-red-700"
                    >
                      Deselect All
                    </button>
                  </>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || isAdmin}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Page</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Route</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Group</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-600">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page) => {
                    const hasPageAccess = getAccess(selectedRoleId, page.id)
                    return (
                      <tr key={page.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-800">{page.page_label}</div>
                          <div className="text-xs text-gray-400">{page.page_key}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 font-mono text-xs">{page.page_path}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {page.nav_group || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => !isAdmin && toggleAccess(page.id)}
                            disabled={isAdmin}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              hasPageAccess
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-red-100 text-red-500 hover:bg-red-200'
                            } ${isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {hasPageAccess ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
