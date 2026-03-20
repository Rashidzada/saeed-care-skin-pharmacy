// G:/msms/frontend/src/components/Layout.jsx
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { BRAND } from '../config/branding'

const pageTitles = {
  '/': 'Dashboard',
  '/medicines': 'Medicines',
  '/sales/new': 'New Sale',
  '/sales': 'Sales History',
  '/purchases': 'Purchases',
  '/suppliers': 'Suppliers',
  '/customers': 'Customers',
  '/reports': 'Reports',
  '/users': 'User Management',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || BRAND.shortName

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={22} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
