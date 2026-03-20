// G:/msms/frontend/src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Pill, ShoppingCart, Package, Truck,
  Users, FileText, UserCog, LogOut, X, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { getAlertsSummary } from '../api/medicines'
import BrandLogo from './BrandLogo'
import { BRAND } from '../config/branding'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/medicines', icon: Pill, label: 'Medicines', end: true },
  { path: '/sales/new', icon: ShoppingCart, label: 'New Sale', end: true },
  { path: '/sales', icon: Activity, label: 'Sales History', end: true },
  { path: '/purchases', icon: Package, label: 'Purchases', end: true },
  { path: '/suppliers', icon: Truck, label: 'Suppliers', end: true },
  { path: '/customers', icon: Users, label: 'Customers', end: true },
  { path: '/reports', icon: FileText, label: 'Reports', end: true },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const { data: alerts } = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: () => getAlertsSummary().then(r => r.data),
    refetchInterval: 60000,
  })

  const alertCount = (alerts?.low_stock || 0) + (alerts?.near_expiry || 0)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-950 text-white z-30
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BrandLogo variant="mark" className="h-9 w-11 shrink-0" />
            <div>
              <h1 className="font-bold text-sm leading-none tracking-[0.18em]">{BRAND.shortName}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{BRAND.subtitle}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-[0.2em]">{BRAND.storeType}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                user?.role === 'admin' ? 'bg-emerald-950 text-emerald-200' :
                user?.role === 'staff' ? 'bg-teal-950 text-teal-200' :
                'bg-slate-800 text-slate-300'
              }`}>
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-150 relative ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-950/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Medicines' && alertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/users"
              end
              onClick={onClose}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-150 ${
                  isActive ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-950/25' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`
              }
            >
              <UserCog size={18} />
              <span>User Management</span>
            </NavLink>
          )}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
