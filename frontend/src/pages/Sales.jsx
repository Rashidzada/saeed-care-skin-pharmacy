import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CreditCard, Eye, Plus, Printer, Receipt, RotateCcw, Wallet, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { getAccessToken } from '../api/axios'
import {
  createSalePayment,
  createSaleReturn,
  getSaleInvoiceUrl,
  getSaleReceiptUrl,
  getSales,
  voidSale,
} from '../api/sales'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const toNumber = (value) => Number(value || 0)
const toCurrency = (value) => `PKR ${toNumber(value).toFixed(2)}`

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
  const [returnModal, setReturnModal] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null)
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnNotes, setReturnNotes] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentNotes, setPaymentNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, search, dateFrom, dateTo, statusFilter],
    queryFn: () =>
      getSales({
        page,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        payment_status: statusFilter || undefined,
      }).then((response) => response.data),
    keepPreviousData: true,
  })

  const invalidateOperationalQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['medicines'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-daily'] })
    queryClient.invalidateQueries({ queryKey: ['report-monthly'] })
    queryClient.invalidateQueries({ queryKey: ['report-stock'] })
  }

  const voidMut = useMutation({
    mutationFn: voidSale,
    onSuccess: () => {
      invalidateOperationalQueries()
      toast.success('Sale voided and stock restored')
      setVoidModal(null)
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || 'Failed to void sale'),
  })

  const returnMut = useMutation({
    mutationFn: ({ id, payload }) => createSaleReturn(id, payload),
    onSuccess: () => {
      invalidateOperationalQueries()
      toast.success('Customer return recorded and stock updated')
      closeReturnModal()
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || 'Failed to record return'),
  })

  const paymentMut = useMutation({
    mutationFn: ({ id, payload }) => createSalePayment(id, payload),
    onSuccess: () => {
      invalidateOperationalQueries()
      toast.success('Customer payment recorded')
      closePaymentModal()
    },
    onError: (err) => {
      const data = err.response?.data
      const message = data?.amount?.[0] || data?.sale?.[0] || data?.error || 'Failed to record payment'
      toast.error(message)
    },
  })

  const openProtectedDocument = (url) => {
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Failed to generate document'))
  }

  const printInvoice = (id) => openProtectedDocument(getSaleInvoiceUrl(id))
  const printReceipt = (id) => openProtectedDocument(getSaleReceiptUrl(id))

  const paymentBadge = (status) => {
    const map = {
      paid: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      pending: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${map[status] || ''}`}>
        {status}
      </span>
    )
  }

  const hasReturnableItems = (sale) =>
    (sale.items || []).some((item) => toNumber(item.returnable_quantity) > 0)

  const openReturnModal = (sale) => {
    const quantities = {}
    ;(sale.items || []).forEach((item) => {
      quantities[item.id] = ''
    })
    setReturnQuantities(quantities)
    setReturnNotes('')
    setReturnModal(sale)
  }

  const closeReturnModal = () => {
    setReturnModal(null)
    setReturnQuantities({})
    setReturnNotes('')
  }

  const openPaymentModal = (sale) => {
    setPaymentModal(sale)
    setPaymentAmount(toNumber(sale.outstanding_amount).toFixed(2))
    setPaymentMethod('cash')
    setPaymentNotes('')
  }

  const closePaymentModal = () => {
    setPaymentModal(null)
    setPaymentAmount('')
    setPaymentMethod('cash')
    setPaymentNotes('')
  }

  const updateReturnQuantity = (saleItemId, maxValue, rawValue) => {
    if (rawValue === '') {
      setReturnQuantities((current) => ({ ...current, [saleItemId]: '' }))
      return
    }

    const nextValue = Math.max(0, Math.min(Number(rawValue), maxValue))
    setReturnQuantities((current) => ({ ...current, [saleItemId]: String(nextValue) }))
  }

  const returnPreviewTotal = useMemo(() => {
    if (!returnModal) {
      return 0
    }

    return (returnModal.items || []).reduce((total, item) => {
      const quantity = Number(returnQuantities[item.id] || 0)
      return total + quantity * toNumber(item.unit_price)
    }, 0)
  }, [returnModal, returnQuantities])

  const submitReturn = () => {
    if (!returnModal) {
      return
    }

    const payloadItems = (returnModal.items || [])
      .map((item) => ({
        sale_item: item.id,
        quantity: Number(returnQuantities[item.id] || 0),
        maxQuantity: toNumber(item.returnable_quantity),
      }))
      .filter((item) => item.quantity > 0)

    if (!payloadItems.length) {
      toast.error('Enter at least one return quantity')
      return
    }
    if (payloadItems.some((item) => item.quantity > item.maxQuantity)) {
      toast.error('One or more return quantities exceed the remaining invoice quantity')
      return
    }

    returnMut.mutate({
      id: returnModal.id,
      payload: {
        notes: returnNotes.trim(),
        items: payloadItems.map(({ sale_item, quantity }) => ({
          sale_item,
          quantity,
        })),
      },
    })
  }

  const submitPayment = () => {
    if (!paymentModal) {
      return
    }

    const amount = Number(paymentAmount || 0)
    const outstanding = toNumber(paymentModal.outstanding_amount)
    if (amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amount > outstanding) {
      toast.error('Payment amount cannot exceed the outstanding balance')
      return
    }

    paymentMut.mutate({
      id: paymentModal.id,
      payload: {
        amount,
        payment_method: paymentMethod,
        notes: paymentNotes.trim(),
      },
    })
  }

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (value) => <span className="font-mono text-sm">{value}</span>,
    },
    {
      key: 'sale_date',
      label: 'Date',
      render: (value) => format(new Date(value), 'dd MMM yyyy HH:mm'),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-800">{row.customer_name || 'Walk-in'}</p>
          <p className="text-xs text-gray-400">{row.customer_phone || 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'total_amount',
      label: 'Invoice',
      render: (value) => <span className="font-semibold">{toCurrency(value)}</span>,
    },
    {
      key: 'returned_amount',
      label: 'Returned',
      render: (value) =>
        toNumber(value) > 0 ? (
          <span className="font-medium text-amber-700">{toCurrency(value)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'total_paid_amount',
      label: 'Paid',
      render: (value) => (
        <span className="font-medium text-sky-700">{toCurrency(value)}</span>
      ),
    },
    {
      key: 'outstanding_amount',
      label: 'Outstanding',
      render: (value) => (
        <span className={`font-semibold ${toNumber(value) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {toCurrency(value)}
        </span>
      ),
    },
    {
      key: 'payment_status',
      label: 'Status',
      render: (value) => paymentBadge(value),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewModal(row)}
            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"
            title="View"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => printInvoice(row.id)}
            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
            title="Print Invoice"
          >
            <Printer size={14} />
          </button>
          <button
            onClick={() => printReceipt(row.id)}
            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded"
            title="Thermal Receipt"
          >
            <Receipt size={14} />
          </button>
          {toNumber(row.outstanding_amount) > 0 && (
            <button
              onClick={() => openPaymentModal(row)}
              className="p-1.5 text-sky-700 hover:bg-sky-50 rounded"
              title="Record Payment"
            >
              <Wallet size={14} />
            </button>
          )}
          {!row.is_voided && hasReturnableItems(row) && (
            <button
              onClick={() => openReturnModal(row)}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
              title="Customer Return"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {isAdmin && !row.is_voided && (
            <button
              onClick={() => setVoidModal(row)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
              title="Void"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="input w-auto text-sm"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="input w-auto text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="input w-auto text-sm"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button
          onClick={() => navigate('/sales/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Sale
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search by invoice, customer, or phone..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No sales found."
      />

      <Modal
        open={!!viewModal}
        onClose={() => setViewModal(null)}
        title={`Sale: ${viewModal?.invoice_number}`}
        size="lg"
      >
        {viewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Date: </span>
                <span className="font-medium">
                  {format(new Date(viewModal.sale_date), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Customer: </span>
                <span className="font-medium">{viewModal.customer_name || 'Walk-in'}</span>
              </div>
              <div>
                <span className="text-gray-500">Customer Phone: </span>
                <span className="font-medium">{viewModal.customer_phone || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Processed by: </span>
                <span className="font-medium">{viewModal.processed_by_name}</span>
              </div>
              <div>
                <span className="text-gray-500">Status: </span>
                {paymentBadge(viewModal.payment_status)}
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 text-xs">Medicine</th>
                  <th className="text-right p-2 text-xs">Sold</th>
                  <th className="text-right p-2 text-xs">Returned</th>
                  <th className="text-right p-2 text-xs">Remaining</th>
                  <th className="text-right p-2 text-xs">Price</th>
                  <th className="text-right p-2 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewModal.items || []).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="p-2">{item.medicine_name}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right text-amber-700">{toNumber(item.returned_quantity)}</td>
                    <td className="p-2 text-right">{toNumber(item.returnable_quantity)}</td>
                    <td className="p-2 text-right">{toCurrency(item.unit_price)}</td>
                    <td className="p-2 text-right font-medium">{toCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-200 pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Total</span>
                  <span>{toCurrency(viewModal.total_amount)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Total Returned</span>
                  <span>{toCurrency(viewModal.returned_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Net Sale</span>
                  <span className="text-emerald-700">{toCurrency(viewModal.net_total_amount)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="text-sky-700 font-semibold">{toCurrency(viewModal.total_paid_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outstanding</span>
                  <span className={`font-semibold ${toNumber(viewModal.outstanding_amount) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {toCurrency(viewModal.outstanding_amount)}
                  </span>
                </div>
                {toNumber(viewModal.credit_amount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Credit Due Back</span>
                    <span className="font-semibold text-purple-700">{toCurrency(viewModal.credit_amount)}</span>
                  </div>
                )}
              </div>
            </div>

            {(viewModal.payments || []).length > 0 && (
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-sm text-slate-800">Payment History</h4>
                <div className="space-y-2">
                  {viewModal.payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-mono text-xs text-sky-700">{payment.reference_number}</span>
                          <p className="text-slate-600">
                            {format(new Date(payment.payment_date), 'dd MMM yyyy HH:mm')}
                            {' / '}
                            {(payment.payment_method || '').replace('_', ' ')}
                          </p>
                        </div>
                        <span className="font-semibold text-sky-800">{toCurrency(payment.amount)}</span>
                      </div>
                      {payment.notes && (
                        <p className="mt-2 text-xs text-slate-500">{payment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(viewModal.returns || []).length > 0 && (
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-sm text-slate-800">Return History</h4>
                <div className="space-y-2">
                  {viewModal.returns.map((saleReturn) => (
                    <div key={saleReturn.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-mono text-xs text-amber-700">{saleReturn.reference_number}</span>
                          <p className="text-slate-600">
                            {format(new Date(saleReturn.return_date), 'dd MMM yyyy HH:mm')}
                            {' / '}
                            {saleReturn.processed_by_name || 'Staff'}
                          </p>
                        </div>
                        <span className="font-semibold text-amber-800">{toCurrency(saleReturn.total_amount)}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        {(saleReturn.items || [])
                          .map((item) => `${item.medicine_name} x${item.quantity}`)
                          .join(', ')}
                      </div>
                      {saleReturn.notes && (
                        <p className="mt-2 text-xs text-slate-500">{saleReturn.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                onClick={() => printInvoice(viewModal.id)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Full Invoice
              </button>
              <button
                onClick={() => printReceipt(viewModal.id)}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <Receipt size={16} /> Thermal
              </button>
              {toNumber(viewModal.outstanding_amount) > 0 && (
                <button
                  onClick={() => {
                    const current = viewModal
                    setViewModal(null)
                    openPaymentModal(current)
                  }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} /> Pay Now
                </button>
              )}
              {!viewModal.is_voided && hasReturnableItems(viewModal) && (
                <button
                  onClick={() => {
                    const current = viewModal
                    setViewModal(null)
                    openReturnModal(current)
                  }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Process Return
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!paymentModal}
        onClose={closePaymentModal}
        title={`Record Payment: ${paymentModal?.invoice_number}`}
        size="sm"
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Customer</span>
                <span className="font-medium">{paymentModal.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-slate-600">Outstanding</span>
                <span className="font-semibold text-sky-700">{toCurrency(paymentModal.outstanding_amount)}</span>
              </div>
            </div>

            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="input"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="jazzcash">JazzCash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                className="input"
                rows={3}
                placeholder="Partial payment note, reference number, or collector detail"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={closePaymentModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paymentMut.isPending}
                className="btn-primary flex-1"
              >
                {paymentMut.isPending ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!returnModal}
        onClose={closeReturnModal}
        title={`Customer Return: ${returnModal?.invoice_number}`}
        size="lg"
      >
        {returnModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select the items the customer brought back. Stock will be added back automatically and the invoice balance will update using the returned value.
            </p>

            <div className="space-y-2">
              {(returnModal.items || []).map((item) => {
                const maxQuantity = toNumber(item.returnable_quantity)
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1.6fr,0.7fr,0.8fr,0.8fr,0.9fr] gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 items-end"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{item.medicine_name}</p>
                      <p className="text-xs text-slate-500">
                        Sold: {item.quantity} / Returned: {toNumber(item.returned_quantity)} / Remaining: {maxQuantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Price</p>
                      <p className="text-sm font-medium">{toCurrency(item.unit_price)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Return Qty</label>
                      <input
                        type="number"
                        min="0"
                        max={maxQuantity}
                        value={returnQuantities[item.id] ?? ''}
                        onChange={(event) => updateReturnQuantity(item.id, maxQuantity, event.target.value)}
                        className="input mt-1"
                        disabled={maxQuantity === 0}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Value</p>
                      <p className="text-sm font-medium text-amber-700">
                        {toCurrency(toNumber(returnQuantities[item.id]) * toNumber(item.unit_price))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Stock After</p>
                      <p className="text-sm font-medium">
                        {toNumber(item.current_stock) + toNumber(returnQuantities[item.id])}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={returnNotes}
                onChange={(event) => setReturnNotes(event.target.value)}
                className="input min-h-[90px]"
                placeholder="Reason for return, condition of medicines, or invoice notes"
              />
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Return Value</span>
                <span className="font-semibold text-amber-800">{toCurrency(returnPreviewTotal)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={closeReturnModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={submitReturn}
                disabled={returnMut.isPending}
                className="btn-primary flex-1"
              >
                {returnMut.isPending ? 'Saving Return...' : 'Save Customer Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!voidModal}
        onClose={() => setVoidModal(null)}
        title="Void Sale"
        size="sm"
      >
        <p className="text-gray-600 mb-4 text-sm">
          Void sale <strong>{voidModal?.invoice_number}</strong>? Stock will be restored. If the customer only brought back some items, use <strong>Process Return</strong> instead.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setVoidModal(null)} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => voidMut.mutate(voidModal.id)}
            disabled={voidMut.isPending}
            className="btn-danger flex-1"
          >
            {voidMut.isPending ? 'Voiding...' : 'Void Sale'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
