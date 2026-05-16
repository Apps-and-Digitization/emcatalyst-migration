import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import JobNotificationPanel from '../JobNotificationPanel'

export default function Layout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-neutral-100)' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 'var(--sidenav-width)',
          padding: '24px',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
      <JobNotificationPanel />
    </div>
  )
}
