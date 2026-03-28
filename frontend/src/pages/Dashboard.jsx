import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

import { getDashboardStats } from '../api/reports'
import StatCard from '../components/StatCard'

const toNumber = (value) => Number(value || 0)
const toCurrency = (value) => `PKR ${toNumber(value).toFixed(2)}`

function MiniBreakdown({ title, tone, primaryLabel, primaryValue, rows = [] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>
          {primaryLabel}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{primaryValue}</p>
      <div className="mt-4 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-gray-600">
            <span>{row.label}</span>
            <span className="font-medium text-gray-800">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingList({ title, emptyMessage, rows = [] }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{row.name}</p>
                  <p className="text-xs text-gray-400">{row.phone || 'No phone on file'}</p>
                </div>
                <span className="font-semibold text-amber-700">{toCurrency(row.outstanding_amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{row.invoice_count} open invoice{row.invoice_count !== 1 ? 's' : ''}</span>
                <span>Paid {toCurrency(row.paid_amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats().then((response) => response.data),
    refetchInterval: 30000,
  })

  const chartData = (data?.chart_data || []).map((item) => ({
    ...item,
    label: format(parseISO(item.date), 'EEE'),
  }))

  const recentSales = data?.recent_sales || []
  const medicines = data?.medicines || {}
  const today = data?.today || {}
  const receivables = data?.receivables || {}
  const payables = data?.payables || {}

  return (
    <div className="space-y-6">
      {medicines.low_stock > 0 && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={() => navigate('/medicines')}
        >
          <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {medicines.low_stock} medicine{medicines.low_stock > 1 ? 's are' : ' is'} running low on stock
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
              {medicines.near_expiry} medicine{medicines.near_expiry > 1 ? 's expire' : ' expires'} within 30 days
            </p>
            <p className="text-xs text-orange-600">Take action before they expire</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <StatCard
          title="Today's Revenue"
          value={isLoading ? '...' : toCurrency(today.revenue)}
          icon={DollarSign}
          color="blue"
          subtitle={`${today.transactions || 0} transaction${today.transactions !== 1 ? 's' : ''}`}
        />
        <StatCard
          title="Payments Received"
          value={isLoading ? '...' : toCurrency(today.payments_received)}
          icon={Wallet}
          color="green"
          subtitle="Collected today"
        />
        <StatCard
          title="Customer Pending"
          value={isLoading ? '...' : toCurrency(receivables.outstanding_total)}
          icon={TrendingUp}
          color="yellow"
          subtitle={`${receivables.pending_invoices || 0} pending / ${receivables.partial_invoices || 0} partial`}
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title="Supplier Pending"
          value={isLoading ? '...' : toCurrency(payables.outstanding_total)}
          icon={TrendingDown}
          color="orange"
          subtitle={`${payables.pending_invoices || 0} pending / ${payables.partial_invoices || 0} partial`}
          onClick={() => navigate('/purchases')}
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MiniBreakdown
          title="Customer Receivables"
          tone="bg-amber-100 text-amber-700"
          primaryLabel="Outstanding"
          primaryValue={isLoading ? '...' : toCurrency(receivables.outstanding_total)}
          rows={[
            { label: 'Registered customer balance', value: toCurrency(receivables.registered_customer_outstanding) },
            { label: 'Walk-in balance', value: toCurrency(receivables.walk_in_outstanding) },
            { label: 'Collected so far', value: toCurrency(receivables.paid_total) },
            { label: 'Paid invoices', value: receivables.paid_invoices || 0 },
          ]}
        />
        <MiniBreakdown
          title="Supplier Payables"
          tone="bg-rose-100 text-rose-700"
          primaryLabel="Outstanding"
          primaryValue={isLoading ? '...' : toCurrency(payables.outstanding_total)}
          rows={[
            { label: 'Paid to suppliers', value: toCurrency(payables.paid_total) },
            { label: 'Pending invoices', value: payables.pending_invoices || 0 },
            { label: 'Partial invoices', value: payables.partial_invoices || 0 },
            { label: 'Paid invoices', value: payables.paid_invoices || 0 },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `PKR ${value}`} />
                <Tooltip
                  formatter={(value) => [`PKR ${Number(value).toFixed(2)}`, 'Revenue']}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Sales</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 bg-gray-100 rounded animate-pulse" />
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
                    <p className="text-sm font-semibold text-gray-800">{toCurrency(sale.net_total_amount || sale.total_amount)}</p>
                    <p className={`text-xs font-medium ${toNumber(sale.outstanding_amount) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                      Due {toCurrency(sale.outstanding_amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="mt-3 w-full text-center text-xs text-emerald-700 hover:text-emerald-900 font-medium inline-flex items-center justify-center gap-1"
          >
            View all sales <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PendingList
          title="Customers With Pending Balance"
          rows={receivables.customers || []}
          emptyMessage="No registered customer balances are pending."
        />
        <PendingList
          title="Suppliers To Pay"
          rows={payables.suppliers || []}
          emptyMessage="No supplier balances are pending."
        />
      </div>
    </div>
  )
}
