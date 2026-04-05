import { useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CreditCard, Eye, Plus, Printer, Receipt, RotateCcw, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

import { getAccessToken } from '../api/axios'
import { getMedicines } from '../api/medicines'
import {
  createPurchase,
  createPurchasePayment,
  createPurchaseReturn,
  getPurchaseInvoiceUrl,
  getPurchaseReceiptUrl,
  getPurchases,
} from '../api/purchases'
import { getSuppliers } from '../api/suppliers'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

const toNumber = (value) => Number(value || 0)
const toCurrency = (value) => `PKR ${toNumber(value).toFixed(2)}`
const calculatePurchaseTotal = (items = []) =>
  items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_cost), 0)

export default function Purchases() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [viewModal, setViewModal] = useState(null)
  const [returnModal, setReturnModal] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null)
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnNotes, setReturnNotes] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentNotes, setPaymentNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search, statusFilter],
    queryFn: () =>
      getPurchases({
        page,
        search: search || undefined,
        payment_status: statusFilter || undefined,
      }).then((response) => response.data),
    keepPreviousData: true,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () =>
      getSuppliers({ page_size: 100, active: 'true' }).then(
        (response) => response.data.results || response.data,
      ),
  })

  const { data: medData } = useQuery({
    queryKey: ['medicines-all-purchase'],
    queryFn: () =>
      getMedicines({ page_size: 200 }).then((response) => response.data.results || response.data),
  })

  const medicines = Array.isArray(medData) ? medData : medData?.results || []

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      supplier: '',
      purchase_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      notes: '',
      payment_status: 'paid',
      amount_paid: '',
      payment_method: 'cash',
      items: [{ medicine: '', quantity: 1, unit_cost: '', batch_number: '', expiry_date: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) || []
  const watchedPaymentStatus = useWatch({ control, name: 'payment_status' }) || 'paid'
  const watchedAmountPaid = useWatch({ control, name: 'amount_paid' })

  const draftTotal = useMemo(
    () => calculatePurchaseTotal(watchedItems),
    [watchedItems],
  )
  const draftPaid = useMemo(() => {
    if (watchedPaymentStatus === 'pending') {
      return 0
    }
    if (watchedAmountPaid === '' || watchedAmountPaid == null) {
      return watchedPaymentStatus === 'paid' ? draftTotal : 0
    }
    return Math.max(0, Math.min(Number(watchedAmountPaid), draftTotal))
  }, [draftTotal, watchedAmountPaid, watchedPaymentStatus])
  const draftOutstanding = Math.max(draftTotal - draftPaid, 0)

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] })
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    queryClient.invalidateQueries({ queryKey: ['medicines'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-stock'] })
  }

  const createMut = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      invalidateQueries()
      toast.success('Purchase recorded successfully')
      closeCreateModal()
    },
    onError: (err) => {
      const data = err.response?.data
      toast.error(data?.amount_paid?.[0] || data?.error || 'Failed to record purchase')
    },
  })
  const returnMut = useMutation({
    mutationFn: ({ id, payload }) => createPurchaseReturn(id, payload),
    onSuccess: () => {
      invalidateQueries()
      toast.success('Supplier return recorded and stock updated')
      closeReturnModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to record supplier return'),
  })
  const paymentMut = useMutation({
    mutationFn: ({ id, payload }) => createPurchasePayment(id, payload),
    onSuccess: () => {
      invalidateQueries()
      toast.success('Supplier payment recorded')
      closePaymentModal()
    },
    onError: (err) => {
      const data = err.response?.data
      toast.error(data?.amount?.[0] || data?.purchase?.[0] || data?.error || 'Failed to record supplier payment')
    },
  })

  const resetFormValues = {
    supplier: '',
    purchase_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    notes: '',
    payment_status: 'paid',
    amount_paid: '',
    payment_method: 'cash',
    items: [{ medicine: '', quantity: 1, unit_cost: '', batch_number: '', expiry_date: '' }],
  }
  const closeCreateModal = () => { setCreateModal(false); reset(resetFormValues) }
  const closeReturnModal = () => { setReturnModal(null); setReturnQuantities({}); setReturnNotes('') }
  const closePaymentModal = () => { setPaymentModal(null); setPaymentAmount(''); setPaymentMethod('cash'); setPaymentNotes('') }

  const openProtectedDocument = (url) => {
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Failed to generate document'))
  }
  const printInvoice = (id) => openProtectedDocument(getPurchaseInvoiceUrl(id))
  const printReceipt = (id) => openProtectedDocument(getPurchaseReceiptUrl(id))

  const onSubmit = (formData) => {
    const purchaseTotal = calculatePurchaseTotal(formData.items || [])
    const amountPaid = formData.payment_status === 'pending'
      ? 0
      : formData.amount_paid === '' || formData.amount_paid == null
        ? (formData.payment_status === 'paid' ? purchaseTotal : 0)
        : Number(formData.amount_paid)
    if (purchaseTotal <= 0) return toast.error('Add at least one line item with quantity and unit cost')
    if (amountPaid > purchaseTotal) return toast.error('Amount paid cannot exceed the purchase total')
    if (formData.payment_status === 'paid' && amountPaid < purchaseTotal) return toast.error('Paid purchases must have the full amount recorded')
    if (formData.payment_status === 'pending' && amountPaid > 0) return toast.error('Pending purchases should not have a payment recorded. Use partial instead.')
    if (formData.payment_status === 'partial' && (amountPaid <= 0 || amountPaid >= purchaseTotal)) return toast.error('Partial payment must be more than zero and less than the purchase total')
    createMut.mutate({
      ...formData,
      supplier: Number(formData.supplier),
      amount_paid: amountPaid,
      items: formData.items.map((item) => ({
        medicine: Number(item.medicine),
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        batch_number: item.batch_number || '',
        expiry_date: item.expiry_date || null,
      })),
    })
  }

  const paymentBadge = (status) => {
    const map = { paid: 'bg-green-100 text-green-700', partial: 'bg-yellow-100 text-yellow-700', pending: 'bg-red-100 text-red-700' }
    return <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${map[status] || ''}`}>{status}</span>
  }
  const hasReturnableItems = (purchase) => (purchase.items || []).some((item) => toNumber(item.returnable_quantity) > 0)

  const openReturnModal = (purchase) => {
    const quantities = {}
    ;(purchase.items || []).forEach((item) => { quantities[item.id] = '' })
    setReturnQuantities(quantities)
    setReturnNotes('')
    setReturnModal(purchase)
  }
  const updateReturnQuantity = (purchaseItemId, maxValue, rawValue) => {
    if (rawValue === '') return setReturnQuantities((current) => ({ ...current, [purchaseItemId]: '' }))
    const nextValue = Math.max(0, Math.min(Number(rawValue), maxValue))
    setReturnQuantities((current) => ({ ...current, [purchaseItemId]: String(nextValue) }))
  }
  const returnPreviewTotal = useMemo(() => {
    if (!returnModal) return 0
    return (returnModal.items || []).reduce((total, item) => total + Number(returnQuantities[item.id] || 0) * toNumber(item.unit_cost), 0)
  }, [returnModal, returnQuantities])
  const submitReturn = () => {
    if (!returnModal) return
    const payloadItems = (returnModal.items || [])
      .map((item) => ({
        purchase_item: item.id,
        quantity: Number(returnQuantities[item.id] || 0),
        maxQuantity: Math.min(toNumber(item.returnable_quantity), toNumber(item.current_stock)),
      }))
      .filter((item) => item.quantity > 0)
    if (!payloadItems.length) return toast.error('Enter at least one return quantity')
    if (payloadItems.some((item) => item.quantity > item.maxQuantity)) return toast.error('One or more quantities exceed the remaining stock or purchase quantity')
    returnMut.mutate({
      id: returnModal.id,
      payload: {
        notes: returnNotes.trim(),
        items: payloadItems.map(({ purchase_item, quantity }) => ({ purchase_item, quantity })),
      },
    })
  }

  const openPaymentModal = (purchase) => {
    setPaymentModal(purchase)
    setPaymentAmount(toNumber(purchase.outstanding_amount).toFixed(2))
    setPaymentMethod('cash')
    setPaymentNotes('')
  }
  const submitPayment = () => {
    if (!paymentModal) return
    const amount = Number(paymentAmount || 0)
    const outstanding = toNumber(paymentModal.outstanding_amount)
    if (amount <= 0) return toast.error('Enter a valid payment amount')
    if (amount > outstanding) return toast.error('Payment amount cannot exceed the outstanding supplier balance')
    paymentMut.mutate({
      id: paymentModal.id,
      payload: { amount, payment_method: paymentMethod, notes: paymentNotes.trim() },
    })
  }

  const columns = [
    { key: 'po_number', label: 'PO #', render: (value) => <span className="font-mono text-sm">{value}</span> },
    { key: 'purchase_date', label: 'Date', render: (value) => format(new Date(value), 'dd MMM yyyy') },
    { key: 'supplier_name', label: 'Supplier', render: (_, row) => <div><p className="font-medium text-gray-800">{row.supplier_name}</p><p className="text-xs text-gray-400">{row.supplier_phone || 'No phone'}</p></div> },
    { key: 'net_total_cost', label: 'Net Cost', render: (value) => <span className="font-semibold">{toCurrency(value)}</span> },
    { key: 'total_paid_amount', label: 'Paid', render: (value) => <span className="font-medium text-sky-700">{toCurrency(value)}</span> },
    { key: 'outstanding_amount', label: 'Outstanding', render: (value) => <span className={`font-semibold ${toNumber(value) > 0 ? 'text-amber-700' : 'text-green-700'}`}>{toCurrency(value)}</span> },
    { key: 'payment_status', label: 'Status', render: (value) => paymentBadge(value) },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewModal(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded" title="View"><Eye size={14} /></button>
          <button onClick={() => printInvoice(row.id)} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded" title="Print Purchase Order"><Printer size={14} /></button>
          <button onClick={() => printReceipt(row.id)} className="p-1.5 text-slate-600 hover:bg-slate-50 rounded" title="Compact Slip"><Receipt size={14} /></button>
          {toNumber(row.outstanding_amount) > 0 && <button onClick={() => openPaymentModal(row)} className="p-1.5 text-sky-700 hover:bg-sky-50 rounded" title="Record Supplier Payment"><Wallet size={14} /></button>}
          {hasReturnableItems(row) && <button onClick={() => openReturnModal(row)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Return to Supplier"><RotateCcw size={14} /></button>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input w-auto text-sm">
          <option value="">All Statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option>
        </select>
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Record Purchase</button>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(value) => { setSearch(value); setPage(1) }}
        searchPlaceholder="Search by supplier or invoice number..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No purchases recorded."
      />

      <Modal open={createModal} onClose={closeCreateModal} title="Record New Purchase" size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="label">Supplier *</label>
              <select {...register('supplier', { required: 'Supplier is required' })} className="input">
                <option value="">Select supplier</option>
                {(suppliers || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              {errors.supplier && <p className="text-red-500 text-xs mt-1">{errors.supplier.message}</p>}
            </div>
            <div><label className="label">Purchase Date *</label><input {...register('purchase_date', { required: true })} type="date" className="input" /></div>
            <div><label className="label">Supplier Invoice #</label><input {...register('invoice_number')} className="input" placeholder="Supplier's invoice reference" /></div>
            <div>
              <label className="label">Payment Status</label>
              <select
                {...register('payment_status', {
                  onChange: (event) => {
                    if (event.target.value === 'pending') {
                      setValue('amount_paid', '')
                    }
                  },
                })}
                className="input"
              >
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="label">Amount Paid Now (PKR)</label>
              <input
                {...register('amount_paid')}
                type="number"
                step="0.01"
                min="0"
                disabled={watchedPaymentStatus === 'pending'}
                className={`input ${watchedPaymentStatus === 'pending' ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}
                placeholder={
                  watchedPaymentStatus === 'partial'
                    ? 'Enter payment made now'
                    : watchedPaymentStatus === 'paid'
                      ? 'Leave blank to use full total'
                      : 'Pending purchases keep this at zero'
                }
              />
              {watchedPaymentStatus === 'pending' && (
                <p className="mt-1 text-xs text-slate-500">
                  Pending purchases do not record a payment. Use Partial if you already paid something.
                </p>
              )}
            </div>
            <div><label className="label">Payment Method</label><select {...register('payment_method')} className="input"><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="other">Other</option></select></div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-gray-500">Purchase Total</p><p className="font-semibold">{toCurrency(draftTotal)}</p></div>
              <div><p className="text-gray-500">Paid Now</p><p className="font-semibold text-sky-700">{toCurrency(draftPaid)}</p></div>
              <div><p className="text-gray-500">Outstanding</p><p className={`font-semibold ${draftOutstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>{toCurrency(draftOutstanding)}</p></div>
            </div>
          </div>

          <div><label className="label">Notes</label><input {...register('notes')} className="input" placeholder="Optional notes" /></div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-sm text-gray-700">Line Items *</label>
              <button type="button" onClick={() => append({ medicine: '', quantity: 1, unit_cost: '', batch_number: '', expiry_date: '' })} className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"><Plus size={14} /> Add Item</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 bg-gray-50 p-2 rounded-lg items-end">
                  <div className="col-span-2"><label className="text-xs text-gray-500">Medicine</label><select {...register(`items.${index}.medicine`, { required: true })} className="input text-xs"><option value="">Select...</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Qty</label><input {...register(`items.${index}.quantity`, { min: 1, valueAsNumber: true })} type="number" min="1" className="input text-xs" placeholder="1" /></div>
                  <div><label className="text-xs text-gray-500">Unit Cost (PKR)</label><input {...register(`items.${index}.unit_cost`, { required: true, valueAsNumber: true })} type="number" step="0.01" className="input text-xs" placeholder="0.00" /></div>
                  <div><label className="text-xs text-gray-500">Batch #</label><input {...register(`items.${index}.batch_number`)} className="input text-xs" placeholder="Optional" /></div>
                  <div className="flex gap-1 items-end">
                    <div className="flex-1"><label className="text-xs text-gray-500">Expiry</label><input {...register(`items.${index}.expiry_date`)} type="date" className="input text-xs" /></div>
                    {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded mb-0.5"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Recording...' : 'Record Purchase'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={`Purchase: ${viewModal?.po_number}`} size="lg">
        {viewModal && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">Supplier: </span><strong>{viewModal.supplier_name}</strong></div>
              <div><span className="text-gray-500">Supplier Phone: </span><strong>{viewModal.supplier_phone || '-'}</strong></div>
              <div><span className="text-gray-500">Date: </span><strong>{format(new Date(viewModal.purchase_date), 'dd MMM yyyy')}</strong></div>
              <div><span className="text-gray-500">Recorded by: </span><strong>{viewModal.recorded_by_name}</strong></div>
              {viewModal.invoice_number && <div><span className="text-gray-500">Ref: </span><strong>{viewModal.invoice_number}</strong></div>}
              <div><span className="text-gray-500">Status: </span>{paymentBadge(viewModal.payment_status)}</div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50"><th className="text-left p-2 text-xs">Medicine</th><th className="p-2 text-xs">Batch</th><th className="p-2 text-xs">Expiry</th><th className="text-right p-2 text-xs">Purchased</th><th className="text-right p-2 text-xs">Returned</th><th className="text-right p-2 text-xs">Current Stock</th><th className="text-right p-2 text-xs">Unit Cost</th><th className="text-right p-2 text-xs">Total</th></tr></thead>
              <tbody>{(viewModal.items || []).map((item) => <tr key={item.id} className="border-b border-gray-100"><td className="p-2">{item.medicine_name}</td><td className="p-2">{item.batch_number || '-'}</td><td className="p-2">{item.expiry_date || '-'}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right text-amber-700">{toNumber(item.returned_quantity)}</td><td className="p-2 text-right">{toNumber(item.current_stock)}</td><td className="p-2 text-right">{toCurrency(item.unit_cost)}</td><td className="p-2 text-right font-medium">{toCurrency(item.line_total)}</td></tr>)}</tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-200 pt-3">
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Purchase Total</span><span>{toCurrency(viewModal.total_cost)}</span></div>
                <div className="flex justify-between text-amber-700"><span>Returned to Supplier</span><span>{toCurrency(viewModal.returned_amount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Net Cost</span><span className="text-emerald-700">{toCurrency(viewModal.net_total_cost)}</span></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-sky-700 font-semibold">{toCurrency(viewModal.total_paid_amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className={`font-semibold ${toNumber(viewModal.outstanding_amount) > 0 ? 'text-amber-700' : 'text-green-700'}`}>{toCurrency(viewModal.outstanding_amount)}</span></div>
              </div>
            </div>

            {(viewModal.payments || []).length > 0 && <div className="space-y-3 border-t border-gray-200 pt-4"><h4 className="font-semibold text-sm text-slate-800">Payment History</h4><div className="space-y-2">{viewModal.payments.map((payment) => <div key={payment.id} className="rounded-xl border border-sky-100 bg-sky-50/60 p-3"><div className="flex items-center justify-between gap-3 text-sm"><div><span className="font-mono text-xs text-sky-700">{payment.reference_number}</span><p className="text-slate-600">{format(new Date(payment.payment_date), 'dd MMM yyyy HH:mm')} / {(payment.payment_method || '').replace('_', ' ')}</p></div><span className="font-semibold text-sky-800">{toCurrency(payment.amount)}</span></div>{payment.notes && <p className="mt-2 text-xs text-slate-500">{payment.notes}</p>}</div>)}</div></div>}
            {(viewModal.returns || []).length > 0 && <div className="space-y-3 border-t border-gray-200 pt-4"><h4 className="font-semibold text-sm text-slate-800">Return History</h4><div className="space-y-2">{viewModal.returns.map((purchaseReturn) => <div key={purchaseReturn.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3"><div className="flex items-center justify-between gap-3 text-sm"><div><span className="font-mono text-xs text-amber-700">{purchaseReturn.reference_number}</span><p className="text-slate-600">{format(new Date(purchaseReturn.return_date), 'dd MMM yyyy HH:mm')} / {purchaseReturn.recorded_by_name || 'Staff'}</p></div><span className="font-semibold text-amber-800">{toCurrency(purchaseReturn.total_amount)}</span></div><div className="mt-2 text-xs text-slate-600">{(purchaseReturn.items || []).map((item) => `${item.medicine_name} x${item.quantity}`).join(', ')}</div>{purchaseReturn.notes && <p className="mt-2 text-xs text-slate-500">{purchaseReturn.notes}</p>}</div>)}</div></div>}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button onClick={() => printInvoice(viewModal.id)} className="btn-secondary flex items-center justify-center gap-2"><Printer size={16} /> Full Invoice</button>
              <button onClick={() => printReceipt(viewModal.id)} className="btn-secondary flex items-center justify-center gap-2"><Receipt size={16} /> Compact Slip</button>
              {toNumber(viewModal.outstanding_amount) > 0 && <button onClick={() => { const current = viewModal; setViewModal(null); openPaymentModal(current) }} className="btn-primary flex items-center justify-center gap-2"><CreditCard size={16} /> Pay Supplier</button>}
              {hasReturnableItems(viewModal) && <button onClick={() => { const current = viewModal; setViewModal(null); openReturnModal(current) }} className="btn-primary flex items-center justify-center gap-2"><RotateCcw size={16} /> Return to Supplier</button>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!paymentModal} onClose={closePaymentModal} title={`Supplier Payment: ${paymentModal?.po_number}`} size="sm">
        {paymentModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Supplier</span><span className="font-medium">{paymentModal.supplier_name}</span></div>
              <div className="flex justify-between mt-2"><span className="text-slate-600">Outstanding</span><span className="font-semibold text-sky-700">{toCurrency(paymentModal.outstanding_amount)}</span></div>
            </div>
            <div><label className="label">Amount</label><input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="input" /></div>
            <div><label className="label">Payment Method</label><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input"><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="other">Other</option></select></div>
            <div><label className="label">Notes</label><textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} className="input" rows={3} placeholder="Cheque number, bank transfer ref, or supplier note" /></div>
            <div className="flex gap-3"><button onClick={closePaymentModal} className="btn-secondary flex-1">Cancel</button><button onClick={submitPayment} disabled={paymentMut.isPending} className="btn-primary flex-1">{paymentMut.isPending ? 'Saving...' : 'Save Payment'}</button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!returnModal} onClose={closeReturnModal} title={`Supplier Return: ${returnModal?.po_number}`} size="lg">
        {returnModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Choose the medicines going back to the supplier. Stock will be reduced from the pharmacy immediately after saving this supplier return.</p>
            <div className="space-y-2">
              {(returnModal.items || []).map((item) => {
                const maxQuantity = Math.min(toNumber(item.returnable_quantity), toNumber(item.current_stock))
                return (
                  <div key={item.id} className="grid grid-cols-[1.7fr,0.9fr,0.8fr,0.8fr,0.9fr] gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 items-end">
                    <div><p className="font-medium text-slate-800">{item.medicine_name}</p><p className="text-xs text-slate-500">Purchased: {item.quantity} / Already returned: {toNumber(item.returned_quantity)} / In stock: {toNumber(item.current_stock)}</p></div>
                    <div><p className="text-xs text-slate-500 mb-1">Can Return</p><p className="text-sm font-medium">{maxQuantity}</p></div>
                    <div><label className="text-xs text-slate-500">Return Qty</label><input type="number" min="0" max={maxQuantity} value={returnQuantities[item.id] ?? ''} onChange={(event) => updateReturnQuantity(item.id, maxQuantity, event.target.value)} className="input mt-1" disabled={maxQuantity === 0} /></div>
                    <div><p className="text-xs text-slate-500 mb-1">Unit Cost</p><p className="text-sm font-medium">{toCurrency(item.unit_cost)}</p></div>
                    <div><p className="text-xs text-slate-500 mb-1">Return Value</p><p className="text-sm font-medium text-amber-700">{toCurrency(toNumber(returnQuantities[item.id]) * toNumber(item.unit_cost))}</p></div>
                  </div>
                )
              })}
            </div>
            <div><label className="label">Notes</label><textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} className="input min-h-[90px]" placeholder="Reason for supplier return, damaged stock, expiry issue, or transport note" /></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm"><div className="flex justify-between"><span className="text-slate-600">Supplier Return Value</span><span className="font-semibold text-amber-800">{toCurrency(returnPreviewTotal)}</span></div></div>
            <div className="flex gap-3"><button onClick={closeReturnModal} className="btn-secondary flex-1">Cancel</button><button onClick={submitReturn} disabled={returnMut.isPending} className="btn-primary flex-1">{returnMut.isPending ? 'Saving Return...' : 'Save Supplier Return'}</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
