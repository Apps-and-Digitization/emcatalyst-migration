import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import EntitiesTab from './components/EntitiesTab'
import DivisionsTab from './components/DivisionsTab'
import DoctorsTab from './components/DoctorsTab'
import BrandsTab from './components/BrandsTab'
import TherapeuticsTab from './components/TherapeuticsTab'
import DocumentTypesTab from './components/DocumentTypesTab'
import MealsTab from './components/MealsTab'
import FmvParametersTab from './components/FmvParametersTab'
import BudgetTab from './components/BudgetTab'

const TABS = ['Entity', 'Division', 'Doctor', 'Brand', 'Therapeutical', 'Document Type', 'Meal', 'FMV Parameter', 'Budget']

export default function Masters() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="p-8">
      <PageHeader title="Master Data" subtitle="Reference data used across the application" />

      {/* Tabs */}
      <div className="flex gap-0 border-b mb-6 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === i ? 'border-emcure-blue text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && <EntitiesTab />}
      {activeTab === 1 && <DivisionsTab />}
      {activeTab === 2 && <DoctorsTab />}
      {activeTab === 3 && <BrandsTab />}
      {activeTab === 4 && <TherapeuticsTab />}
      {activeTab === 5 && <DocumentTypesTab />}
      {activeTab === 6 && <MealsTab />}
      {activeTab === 7 && <FmvParametersTab />}
      {activeTab === 8 && <BudgetTab />}
    </div>
  )
}
