import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronRight, ChevronDown, Users, User, ArrowUp, Building2 } from 'lucide-react'
import { accessApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

/* ── Small card for a single person ── */
function PersonCard({ person, level = 0, highlight = false }) {
  const colors = [
    'border-blue-500 bg-blue-50',
    'border-indigo-400 bg-indigo-50',
    'border-purple-400 bg-purple-50',
    'border-pink-400 bg-pink-50',
    'border-orange-400 bg-orange-50',
  ]
  const color = colors[Math.min(level, colors.length - 1)]
  return (
    <div className={`border-l-4 rounded-r-xl p-3 ${color} ${highlight ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center shrink-0">
          <User size={14} className="text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{person.name || '—'}</p>
          <p className="text-xs text-gray-500 truncate">{person.designation || '—'}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 pl-10">
        <span>{person.employee_id}</span>
        {person.location && <span>📍 {person.location}</span>}
        {person.email && <span className="truncate max-w-[180px]">{person.email}</span>}
      </div>
    </div>
  )
}

/* ── My reporting chain (bottom-up) ── */
function MyChain() {
  const { data: chain = [], isLoading } = useQuery({
    queryKey: ['my-chain'],
    queryFn: () => accessApi.myChain().then(r => r.data),
  })
  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <ArrowUp size={12} /> Your reporting chain (you → L1 → L2 → …)
      </p>
      {chain.map((person, i) => (
        <div key={person.id} className="flex items-start gap-2">
          <div className="flex flex-col items-center pt-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
              ${i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-purple-500' : 'bg-gray-400'}`}>
              {i === 0 ? 'You' : `L${i}`}
            </div>
            {i < chain.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
          </div>
          <div className="flex-1">
            <PersonCard person={person} level={i} highlight={i === 0} />
          </div>
        </div>
      ))}
      {chain.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No hierarchy data found for your account.</p>
      )}
    </div>
  )
}

/* ── Recursive org tree node ── */
function OrgNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={depth > 0 ? 'ml-6 mt-2 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 shrink-0 w-5 h-5 rounded border border-gray-300 flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <div className="mt-2 shrink-0 w-5 h-5" />
        )}
        <div className="flex-1 min-w-0">
          <PersonCard person={node} level={depth} />
          {hasChildren && !expanded && (
            <p className="text-xs text-gray-400 mt-1 ml-1">{node.children.length} direct report{node.children.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map(child => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Search + trace chain for any employee ── */
function EmployeeSearch() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [showResults, setShowResults] = useState(false)

  const { data: results = [] } = useQuery({
    queryKey: ['emp-search', q],
    queryFn: () => accessApi.searchEmployees(q, 15).then(r => r.data),
    enabled: q.length >= 2,
  })

  const { data: chain = [], isLoading: chainLoading } = useQuery({
    queryKey: ['emp-chain', selected?.employee_id],
    queryFn: () => accessApi.userChain(selected.employee_id).then(r => r.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search by name, employee ID or designation…"
          value={q}
          onChange={e => { setQ(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
        />
        {showResults && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.id}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0"
                onClick={() => { setSelected(r); setShowResults(false); setQ(r.name) }}
              >
                <span className="font-medium text-gray-800">{r.name}</span>
                <span className="text-gray-400 ml-2 text-xs">{r.employee_id} · {r.designation}</span>
                {r.manager_name && (
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Reports to: {r.manager_name} ({r.manager_designation})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div>
          {chainLoading ? <LoadingSpinner /> : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUp size={12} /> Reporting chain for {selected.name}
              </p>
              {chain.map((person, i) => (
                <div key={person.id} className="flex items-start gap-2">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                      ${i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-purple-500' : 'bg-gray-400'}`}>
                      {i === 0 ? 'Self' : `L${i}`}
                    </div>
                    {i < chain.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1">
                    <PersonCard person={person} level={i} highlight={i === 0} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Org Tree tab ── */
function OrgTree() {
  const [rootEmpId, setRootEmpId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [depth, setDepth] = useState(3)

  const { data: searchResults = [] } = useQuery({
    queryKey: ['tree-search', searchQ],
    queryFn: () => accessApi.searchEmployees(searchQ, 10).then(r => r.data),
    enabled: searchQ.length >= 2,
  })

  const { data: tree, isLoading } = useQuery({
    queryKey: ['hierarchy-tree', rootEmpId, depth],
    queryFn: () => accessApi.hierarchyTree(rootEmpId || undefined, depth).then(r => r.data),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Start from employee (leave blank for top of your chain)…"
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                  onClick={() => { setRootEmpId(r.employee_id); setSearchQ(r.name); setShowSearch(false) }}
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{r.designation}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select className="input text-sm w-36" value={depth} onChange={e => setDepth(parseInt(e.target.value))}>
          <option value={2}>2 levels deep</option>
          <option value={3}>3 levels deep</option>
          <option value={4}>4 levels deep</option>
          <option value={5}>5 levels deep</option>
        </select>
        {rootEmpId && (
          <button className="btn-secondary text-sm" onClick={() => { setRootEmpId(''); setSearchQ('') }}>
            Reset
          </button>
        )}
      </div>

      {isLoading ? <LoadingSpinner /> : tree ? (
        <div className="bg-gray-50 rounded-xl p-4 overflow-auto max-h-[60vh]">
          <OrgNode node={tree} depth={0} />
        </div>
      ) : null}
    </div>
  )
}

/* ── Main page ── */
export default function HierarchyView() {
  const [tab, setTab] = useState('my_chain')

  const tabs = [
    { id: 'my_chain', label: 'My Reporting Chain', icon: ArrowUp },
    { id: 'search', label: 'Find Employee', icon: Search },
    { id: 'org_tree', label: 'Org Chart', icon: Building2 },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Employee Hierarchy"
        subtitle="View reporting chains, L1/L2 managers, and org chart across 841 employees"
        actions={
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 px-4 py-2 rounded-lg">
            <Users size={16} className="text-blue-500" />
            <span>758 / 841 employees linked</span>
          </div>
        }
      />

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
        <p className="font-semibold text-blue-800 mb-1">How BRS Approvals Work</p>
        <div className="flex flex-wrap gap-6 text-blue-700">
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">You</span>
            Initiator (KAM / ABM)
          </span>
          <ChevronRight size={16} className="text-blue-400 self-center" />
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">L1</span>
            Direct Manager (Zonal Mgr)
          </span>
          <ChevronRight size={16} className="text-blue-400 self-center" />
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">L2</span>
            Manager's Manager (BDM / Regional Mgr)
          </span>
        </div>
        <p className="text-blue-600 text-xs mt-2">
          L1 and L2 approvers are <strong>automatically assigned</strong> when you submit a BRS application.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                ${tab === t.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      <div className="card p-6">
        {tab === 'my_chain' && <MyChain />}
        {tab === 'search' && <EmployeeSearch />}
        {tab === 'org_tree' && <OrgTree />}
      </div>
    </div>
  )
}
