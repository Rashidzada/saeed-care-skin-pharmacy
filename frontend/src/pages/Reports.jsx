// G:/msms/frontend/src/pages/Reports.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { Download, BarChart2, Package, Clock, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { getDailySales, getMonthlySales, getStockReport, getExpiryReport, exportDailySalesCsv, exportStockCsv } from '../api/reports'
import { getAccessToken } from '../api/axios'

const TABS = [
  { key: 'daily', label: 'Daily Sales', icon: BarChart2 },
  { key: 'monthly', label: 'Monthly Sales', icon: TrendingUp },
  { key: 'stock', label: 'Stock Report', icon: Package },
  { key: 'expiry', label: 'Expiry Report', icon: Clock },
]

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily')
  const today = new Date().toISOString().split('T')[0]
  const [dailyDate, setDailyDate] = useState(today)
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1)
  const [expiryDays, setExpiryDays] = useState(30)

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['report-daily', dailyDate],
    queryFn: () => getDailySales(dailyDate).then(r => r.data),
    enabled: activeTab === 'daily',
  })

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['report-monthly', monthlyYear, monthlyMonth],
    queryFn: () => getMonthlySales(monthlyYear, monthlyMonth).then(r => r.data),
    enabled: activeTab === 'monthly',
  })

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['report-stock'],
    queryFn: () => getStockReport().then(r => r.data),
    enabled: activeTab === 'stock',
  })

  const { data: expiryData, isLoading: expiryLoading } = useQuery({
    queryKey: ['report-expiry', expiryDays],
    queryFn: () => getExpiryReport(expiryDays).then(r => r.data),
    enabled: activeTab === 'expiry',
  })

  const downloadCsv = (url) => {
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'report.csv'
        a.click()
      })
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daily Sales */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Date:</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="input w-auto" />
            </div>
            <button onClick={() => downloadCsv(exportDailySalesCsv(dailyDate))} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Export CSV
            </button>
          </div>

          {dailyLoading ? (
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card text-center">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-700">PKR {Number(dailyData?.total_revenue || 0).toFixed(2)}</p>
              </div>
              <div className="card text-center">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-800">{dailyData?.total_transactions || 0}</p>
              </div>
              <div className="card text-center">
                <p className="text-sm text-gray-500">Items Sold</p>
                <p className="text-2xl font-bold text-gray-800">{dailyData?.total_items_sold || 0}</p>
              </div>
            </div>
          )}

          {dailyData?.sales?.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="font-semibold mb-3">Sales Transactions</h3>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left p-2">Invoice</th><th className="text-left p-2">Customer</th><th className="text-right p-2">Total</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {dailyData.sales.map(sale => (
                    <tr key={sale.id} className="border-b border-gray-100">
                      <td className="p-2 font-mono text-xs">{sale.invoice_number}</td>
                      <td className="p-2">{sale.customer_name || 'Walk-in'}</td>
                      <td className="p-2 text-right font-medium">PKR {Number(sale.total_amount).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sale.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{sale.payment_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Monthly Sales */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={monthlyYear} onChange={e => setMonthlyYear(Number(e.target.value))} className="input w-auto">
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={monthlyMonth} onChange={e => setMonthlyMonth(Number(e.target.value))} className="input w-auto">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={i+1}>{format(new Date(2024, i, 1), 'MMMM')}</option>
              ))}
            </select>
          </div>

          {monthlyLoading ? <div className="h-32 bg-gray-100 rounded-xl animate-pulse" /> : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="card text-center">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-700">PKR {Number(monthlyData?.total_revenue || 0).toFixed(2)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold">{monthlyData?.total_transactions || 0}</p>
                </div>
              </div>

              {monthlyData?.daily_breakdown?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3">Daily Revenue Breakdown</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyData.daily_breakdown.map(d => ({ ...d, label: format(new Date(d.date), 'dd') }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `PKR ${v}`} />
                      <Tooltip formatter={v => [`PKR ${Number(v).toFixed(2)}`, 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="#047857" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Stock Report */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => downloadCsv(exportStockCsv())} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Export CSV
            </button>
          </div>

          {stockLoading ? <div className="h-32 bg-gray-100 rounded-xl animate-pulse" /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Medicines', value: stockData?.summary?.total_medicines, color: 'text-emerald-700' },
                  { label: 'Low Stock', value: stockData?.summary?.low_stock, color: 'text-yellow-600' },
                  { label: 'Out of Stock', value: stockData?.summary?.out_of_stock, color: 'text-red-600' },
                  { label: 'Near Expiry', value: stockData?.summary?.near_expiry, color: 'text-orange-600' },
                ].map((s, i) => (
                  <div key={i} className="card text-center">
                    <p className="text-sm text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                  </div>
                ))}
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="text-left p-2">Name</th><th className="p-2">Category</th>
                    <th className="p-2">Batch</th><th className="p-2">Expiry</th>
                    <th className="text-right p-2">Qty</th><th className="text-right p-2">Min</th>
                    <th className="text-right p-2">Price</th><th className="p-2">Status</th>
                  </tr></thead>
                  <tbody>
                    {(stockData?.medicines || []).map(m => (
                      <tr key={m.id} className={`border-b border-gray-100 ${
                        m.status === 'expired' || m.status === 'out_of_stock' ? 'bg-red-50' :
                        m.status === 'near_expiry' ? 'bg-orange-50' :
                        m.status === 'low_stock' ? 'bg-yellow-50' : ''
                      }`}>
                        <td className="p-2 font-medium">{m.name}</td>
                        <td className="p-2 capitalize text-center">{m.category}</td>
                        <td className="p-2 font-mono text-xs text-center">{m.batch_number}</td>
                        <td className="p-2 text-center">{m.expiry_date}</td>
                        <td className="p-2 text-right font-medium">{m.quantity}</td>
                        <td className="p-2 text-right text-gray-500">{m.min_stock_threshold}</td>
                        <td className="p-2 text-right">PKR {m.unit_price}</td>
                        <td className="p-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            m.status === 'healthy' ? 'bg-green-100 text-green-700' :
                            m.status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' :
                            m.status === 'near_expiry' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>{m.status.replace('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Expiry Report */}
      {activeTab === 'expiry' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Expiring within:</label>
            <select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} className="input w-auto">
              <option value={7}>7 days</option>
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {expiryLoading ? <div className="h-32 bg-gray-100 rounded-xl animate-pulse" /> : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="card text-center border-orange-200">
                  <p className="text-sm text-gray-500">Near Expiry</p>
                  <p className="text-2xl font-bold text-orange-600">{expiryData?.near_expiry_count || 0}</p>
                  <p className="text-xs text-gray-400">within {expiryData?.days_window} days</p>
                </div>
                <div className="card text-center border-red-200">
                  <p className="text-sm text-gray-500">Already Expired</p>
                  <p className="text-2xl font-bold text-red-600">{expiryData?.expired_count || 0}</p>
                </div>
              </div>

              {expiryData?.near_expiry?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3 text-orange-700">Expiring Soon</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-orange-50"><th className="text-left p-2">Name</th><th className="p-2">Batch</th><th className="p-2">Expiry Date</th><th className="text-right p-2">Qty</th><th className="p-2">Days Left</th><th className="p-2">Supplier</th></tr></thead>
                      <tbody>
                        {expiryData.near_expiry.map(m => (
                          <tr key={m.id} className="border-b border-orange-100">
                            <td className="p-2 font-medium">{m.name}</td>
                            <td className="p-2 font-mono text-xs">{m.batch_number}</td>
                            <td className="p-2">{m.expiry_date}</td>
                            <td className="p-2 text-right">{m.quantity}</td>
                            <td className="p-2 text-center"><span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{m.days_until_expiry}d</span></td>
                            <td className="p-2">{m.supplier || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expiryData?.expired?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3 text-red-700">Expired Medicines</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-red-50"><th className="text-left p-2">Name</th><th className="p-2">Batch</th><th className="p-2">Expired On</th><th className="text-right p-2">Qty</th></tr></thead>
                      <tbody>
                        {expiryData.expired.map(m => (
                          <tr key={m.id} className="border-b border-red-100 bg-red-50">
                            <td className="p-2 font-medium text-red-800">{m.name}</td>
                            <td className="p-2 font-mono text-xs">{m.batch_number}</td>
                            <td className="p-2 text-red-600">{m.expiry_date}</td>
                            <td className="p-2 text-right text-red-700 font-medium">{m.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
