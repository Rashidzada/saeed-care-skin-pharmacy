// G:/msms/frontend/src/pages/Sales.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, XCircle, Printer, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getSales, getSale, voidSale, getSaleInvoiceUrl } from '../api/sales'
import { getAccessToken } from '../api/axios'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

export default function Sales() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [voidModal, setVoidModal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, search, dateFrom, dateTo, statusFilter],
    queryFn: () => getSales({
      page,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      payment_status: statusFilter || undefined,
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const voidMut = useMutation({
    mutationFn: voidSale,
    onSuccess: () => {
      queryClient.invalidateQueries(['sales'])
      queryClient.invalidateQueries(['medicines'])
      toast.success('Sale voided and stock restored')
      setVoidModal(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to void sale'),
  })

  const printInvoice = (id) => {
    const url = getSaleInvoiceUrl(id)
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Failed to generate invoice'))
  }

  const paymentBadge = (status) => {
    const map = {
      paid: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      pending: 'bg-red-100 text-red-700',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${map[status] || ''}`}>{status}</span>
  }

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', render: (v) => <span className="font-mono text-sm">{v}</span> },
    { key: 'sale_date', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy HH:mm') },
    { key: 'customer_name', label: 'Customer', render: (v) => v || 'Walk-in' },
    { key: 'items', label: 'Items', render: (_, row) => row.items?.length || 0 },
    { key: 'total_amount', label: 'Total', render: (v) => <span className="font-semibold">PKR {Number(v).toFixed(2)}</span> },
    { key: 'payment_status', label: 'Status', render: (v) => paymentBadge(v) },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewModal(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded" title="View">
            <Eye size={14} />
          </button>
          <button onClick={() => printInvoice(row.id)} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded" title="Print Invoice">
            <Printer size={14} />
          </button>
          {isAdmin && !row.is_voided && (
            <button onClick={() => setVoidModal(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Void">
              <XCircle size={14} />
            </button>
          )}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-auto text-sm" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-auto text-sm" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button onClick={() => navigate('/sales/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Sale
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by invoice, customer..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No sales found."
      />

      {/* View Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={`Sale: ${viewModal?.invoice_number}`} size="lg">
        {viewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Date: </span><span className="font-medium">{format(new Date(viewModal.sale_date), 'dd MMM yyyy HH:mm')}</span></div>
              <div><span className="text-gray-500">Customer: </span><span className="font-medium">{viewModal.customer_name || 'Walk-in'}</span></div>
              <div><span className="text-gray-500">Processed by: </span><span className="font-medium">{viewModal.processed_by_name}</span></div>
              <div><span className="text-gray-500">Status: </span>{paymentBadge(viewModal.payment_status)}</div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50"><th className="text-left p-2 text-xs">Medicine</th><th className="text-right p-2 text-xs">Qty</th><th className="text-right p-2 text-xs">Price</th><th className="text-right p-2 text-xs">Total</th></tr></thead>
              <tbody>
                {(viewModal.items || []).map(item => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="p-2">{item.medicine_name}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">PKR {Number(item.unit_price).toFixed(2)}</td>
                    <td className="p-2 text-right font-medium">PKR {Number(item.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-sm space-y-1 border-t border-gray-200 pt-3">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>PKR {Number(viewModal.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax ({viewModal.tax_rate}%)</span><span>PKR {Number(viewModal.tax_amount).toFixed(2)}</span></div>
              {Number(viewModal.discount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-PKR {Number(viewModal.discount).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span className="text-emerald-700">PKR {Number(viewModal.total_amount).toFixed(2)}</span></div>
            </div>

            <button onClick={() => printInvoice(viewModal.id)} className="btn-secondary w-full flex items-center justify-center gap-2">
              <Printer size={16} /> Print Invoice
            </button>
          </div>
        )}
      </Modal>

      {/* Void Confirm */}
      <Modal open={!!voidModal} onClose={() => setVoidModal(null)} title="Void Sale" size="sm">
        <p className="text-gray-600 mb-4 text-sm">Void sale <strong>{voidModal?.invoice_number}</strong>? Stock will be restored.</p>
        <div className="flex gap-3">
          <button onClick={() => setVoidModal(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => voidMut.mutate(voidModal.id)} disabled={voidMut.isPending} className="btn-danger flex-1">
            {voidMut.isPending ? 'Voiding...' : 'Void Sale'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
