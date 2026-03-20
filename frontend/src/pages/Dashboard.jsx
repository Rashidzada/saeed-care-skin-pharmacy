// G:/msms/frontend/src/pages/Dashboard.jsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, Package, AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getDashboardStats } from '../api/reports'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats().then(r => r.data),
    refetchInterval: 30000,
  })

  const chartData = (data?.chart_data || []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'EEE'),
  }))

  const recentSales = data?.recent_sales || []
  const medicines = data?.medicines || {}
  const today = data?.today || {}

  return (
    <div className="space-y-6">
      {/* Alert banners */}
      {medicines.low_stock > 0 && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={() => navigate('/medicines')}
        >
          <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {medicines.low_stock} medicine{medicines.low_stock > 1 ? 's' : ''} {medicines.low_stock > 1 ? 'are' : 'is'} running low on stock
            </p>
            <p className="text-xs text-yellow-600">Click to view and manage inventory</p>
          </div>
        </div>
      )}
      {medicines.near_expiry > 0 && (
        <div
          className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => navigate('/medicines')}
        >
          <Clock size={20} className="text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {medicines.near_expiry} medicine{medicines.near_expiry > 1 ? 's' : ''} expiring within 30 days
            </p>
            <p className="text-xs text-orange-600">Take action before they expire</p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={isLoading ? '...' : `PKR ${Number(today.revenue || 0).toFixed(2)}`}
          icon={DollarSign}
          color="blue"
          subtitle={`${today.transactions || 0} transaction${today.transactions !== 1 ? 's' : ''}`}
        />
        <StatCard
          title="Total Medicines"
          value={isLoading ? '...' : medicines.total || 0}
          icon={Package}
          color="green"
          subtitle="Active in inventory"
        />
        <StatCard
          title="Low Stock Alerts"
          value={isLoading ? '...' : medicines.low_stock || 0}
          icon={AlertTriangle}
          color={medicines.low_stock > 0 ? 'yellow' : 'green'}
          subtitle="Below minimum threshold"
          onClick={() => navigate('/medicines')}
        />
        <StatCard
          title="Expiring Soon"
          value={isLoading ? '...' : medicines.near_expiry || 0}
          icon={Clock}
          color={medicines.near_expiry > 0 ? 'orange' : 'green'}
          subtitle="Within 30 days"
          onClick={() => navigate('/medicines')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-emerald-700" />
            <h3 className="font-semibold text-gray-800">Last 7 Days Revenue</h3>
          </div>
          {isLoading ? (
            <div className="h-48 bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `PKR ${v}`} />
                <Tooltip
                  formatter={(value) => [`PKR ${Number(value).toFixed(2)}`, 'Revenue']}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Sales */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Sales</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))
            ) : recentSales.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No sales yet today</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{sale.invoice_number}</p>
                    <p className="text-xs text-gray-400">{sale.customer_name || 'Walk-in'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">PKR {Number(sale.total_amount).toFixed(2)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                      sale.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {sale.payment_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="mt-3 w-full text-center text-xs text-emerald-700 hover:text-emerald-900 font-medium"
          >
            View all sales →
          </button>
        </div>
      </div>
    </div>
  )
}
