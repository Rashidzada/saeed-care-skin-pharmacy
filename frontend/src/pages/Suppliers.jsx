import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  CreditCard,
  Edit,
  History,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react'

import { getAccessToken } from '../api/axios'
import { createPurchasePayment, getPurchaseInvoiceUrl, getPurchaseReceiptUrl, getPurchases } from '../api/purchases'
import { createSupplier, deleteSupplier, getSuppliers, updateSupplier } from '../api/suppliers'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import { BRAND } from '../config/branding'
import { useAuth } from '../context/AuthContext'
import {
  createWhatsAppUrl,
  fetchAllResults,
  paymentStatusClasses,
  toCurrency,
  toNumber,
} from '../utils/ledger'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
})

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'other', label: 'Other' },
]

const sortPurchasesOldestFirst = (purchases) =>
  [...purchases].sort((left, right) => new Date(left.purchase_date) - new Date(right.purchase_date))

const buildSupplierWhatsAppMessage = (supplier, purchases = []) => {
  const openPurchases = sortPurchasesOldestFirst(
    purchases.filter((purchase) => toNumber(purchase.outstanding_amount) > 0),
  )
  const totalPurchases = purchases.length || toNumber(supplier.purchase_count)
  const totalPaid = purchases.length
    ? purchases.reduce((sum, purchase) => sum + toNumber(purchase.total_paid_amount), 0)
    : toNumber(supplier.total_paid_amount)
  const totalOutstanding = purchases.length
    ? purchases.reduce((sum, purchase) => sum + toNumber(purchase.outstanding_amount), 0)
    : toNumber(supplier.pending_payable)
  const contactName = supplier.contact_person || supplier.name

  const lines = [
    `Assalam o Alaikum ${contactName},`,
    '',
    `This is ${BRAND.displayName}.`,
    '',
    `Payable summary for ${supplier.name}:`,
    `- Total purchase invoices: ${totalPurchases}`,
    `- Open invoices: ${openPurchases.length || toNumber(supplier.open_invoice_count)}`,
    `- Total paid: ${toCurrency(totalPaid)}`,
    `- Total pending: ${toCurrency(totalOutstanding)}`,
  ]

  if (openPurchases.length) {
    lines.push('', 'Open purchase invoices:')
    openPurchases.slice(0, 12).forEach((purchase) => {
      lines.push(
        `- ${purchase.po_number} | ${format(new Date(purchase.purchase_date), 'dd MMM yyyy')} | Due ${toCurrency(purchase.outstanding_amount)}`,
      )
    })
    if (openPurchases.length > 12) {
      lines.push(`- And ${openPurchases.length - 12} more open invoices`)
    }
  } else {
    lines.push('', 'There is no pending supplier balance right now.')
  }

  lines.push(
    '',
    'Please confirm the balance or share the preferred settlement plan.',
    `${BRAND.displayName}`,
    BRAND.phones[0],
  )

  return lines.join('\n')
}

const paymentBadge = (status) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${paymentStatusClasses[status] || 'bg-slate-100 text-slate-700'}`}
  >
    {status}
  </span>
)

export default function Suppliers() {
  const { isStaff } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [ledgerSupplier, setLedgerSupplier] = useState(null)
  const [ledgerPaymentAmount, setLedgerPaymentAmount] = useState('')
  const [ledgerPaymentMethod, setLedgerPaymentMethod] = useState('cash')
  const [ledgerPaymentNotes, setLedgerPaymentNotes] = useState('')
  const [invoicePaymentModal, setInvoicePaymentModal] = useState(null)
  const [invoicePaymentAmount, setInvoicePaymentAmount] = useState('')
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('cash')
  const [invoicePaymentNotes, setInvoicePaymentNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => getSuppliers({ page, search: search || undefined }).then((response) => response.data),
    keepPreviousData: true,
  })

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['supplier-ledger', ledgerSupplier?.id],
    enabled: !!ledgerSupplier,
    queryFn: () => fetchAllResults(getPurchases, { supplier: ledgerSupplier.id }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const supplierPurchases = ledgerData?.results || []

  const ledgerSummary = useMemo(() => {
    const openPurchases = supplierPurchases.filter((purchase) => toNumber(purchase.outstanding_amount) > 0)
    return {
      totalInvoices: supplierPurchases.length,
      openInvoices: openPurchases.length,
      totalReturned: supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.returned_amount), 0),
      totalNetCost: supplierPurchases.reduce(
        (sum, purchase) => sum + toNumber(purchase.net_total_cost || purchase.total_cost),
        0,
      ),
      totalPaid: supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.total_paid_amount), 0),
      totalOutstanding: supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.outstanding_amount), 0),
      totalCredit: supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.credit_amount), 0),
      pendingCount: openPurchases.filter((purchase) => purchase.payment_status === 'pending').length,
      partialCount: openPurchases.filter((purchase) => purchase.payment_status === 'partial').length,
    }
  }, [supplierPurchases])

  const openPurchases = useMemo(
    () => sortPurchasesOldestFirst(supplierPurchases.filter((purchase) => toNumber(purchase.outstanding_amount) > 0)),
    [supplierPurchases],
  )

  const invalidateOperationalQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    queryClient.invalidateQueries({ queryKey: ['purchases'] })
    queryClient.invalidateQueries({ queryKey: ['supplier-ledger'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-stock'] })
    queryClient.invalidateQueries({ queryKey: ['report-monthly'] })
  }

  const createMut = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier added')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add supplier'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data: payload }) => updateSupplier(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update supplier'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier deleted')
      setDeleteModal(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete supplier'),
  })

  const invoicePaymentMut = useMutation({
    mutationFn: ({ id, payload }) => createPurchasePayment(id, payload),
    onSuccess: () => {
      invalidateOperationalQueries()
      toast.success('Supplier payment recorded')
      closeInvoicePaymentModal()
    },
    onError: (err) => {
      const data = err.response?.data
      toast.error(data?.amount?.[0] || data?.purchase?.[0] || data?.error || 'Failed to record supplier payment')
    },
  })

  const ledgerPaymentMut = useMutation({
    mutationFn: async ({ supplierName, amount, paymentMethod, notes, purchases }) => {
      const allocations = []
      let remaining = Number(amount)

      for (const purchase of sortPurchasesOldestFirst(purchases.filter((entry) => toNumber(entry.outstanding_amount) > 0))) {
        if (remaining <= 0) {
          break
        }

        const allocation = Math.min(remaining, toNumber(purchase.outstanding_amount))
        const paymentNotesText = [
          notes.trim(),
          `Ledger payment allocated for ${supplierName}`,
        ].filter(Boolean).join(' | ')

        await createPurchasePayment(purchase.id, {
          amount: Number(allocation.toFixed(2)),
          payment_method: paymentMethod,
          notes: paymentNotesText,
        })

        allocations.push({ poNumber: purchase.po_number, amount: allocation })
        remaining = Number((remaining - allocation).toFixed(2))
      }

      return allocations
    },
    onSuccess: (allocations) => {
      invalidateOperationalQueries()
      setLedgerPaymentAmount('')
      setLedgerPaymentMethod('cash')
      setLedgerPaymentNotes('')
      toast.success(`Payment applied to ${allocations.length} invoice${allocations.length === 1 ? '' : 's'}`)
    },
    onError: (err) => {
      const data = err.response?.data
      toast.error(data?.amount?.[0] || data?.purchase?.[0] || data?.error || 'Failed to apply payment')
    },
  })

  const openProtectedDocument = (url) => {
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Failed to generate document'))
  }

  const printInvoice = (id) => openProtectedDocument(getPurchaseInvoiceUrl(id))
  const printReceipt = (id) => openProtectedDocument(getPurchaseReceiptUrl(id))

  const openAdd = () => {
    setEditItem(null)
    reset({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset(item)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditItem(null)
  }

  const openLedger = (supplier) => {
    setLedgerSupplier(supplier)
    setLedgerPaymentAmount('')
    setLedgerPaymentMethod('cash')
    setLedgerPaymentNotes('')
  }

  const closeLedger = () => {
    setLedgerSupplier(null)
    setLedgerPaymentAmount('')
    setLedgerPaymentMethod('cash')
    setLedgerPaymentNotes('')
  }

  const openInvoicePaymentModal = (purchase) => {
    setInvoicePaymentModal(purchase)
    setInvoicePaymentAmount(toNumber(purchase.outstanding_amount).toFixed(2))
    setInvoicePaymentMethod('cash')
    setInvoicePaymentNotes('')
  }

  const closeInvoicePaymentModal = () => {
    setInvoicePaymentModal(null)
    setInvoicePaymentAmount('')
    setInvoicePaymentMethod('cash')
    setInvoicePaymentNotes('')
  }

  const onSubmit = (formData) => {
    if (editItem) {
      updateMut.mutate({ id: editItem.id, data: formData })
      return
    }

    createMut.mutate(formData)
  }

  const submitInvoicePayment = () => {
    if (!invoicePaymentModal) {
      return
    }

    const amount = Number(invoicePaymentAmount || 0)
    const outstanding = toNumber(invoicePaymentModal.outstanding_amount)
    if (amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amount > outstanding) {
      toast.error('Payment amount cannot exceed the outstanding supplier balance')
      return
    }

    invoicePaymentMut.mutate({
      id: invoicePaymentModal.id,
      payload: {
        amount,
        payment_method: invoicePaymentMethod,
        notes: invoicePaymentNotes.trim(),
      },
    })
  }

  const submitLedgerPayment = () => {
    if (!ledgerSupplier) {
      return
    }

    const amount = Number(ledgerPaymentAmount || 0)
    if (amount <= 0) {
      toast.error('Enter the amount you are paying now')
      return
    }
    if (amount > ledgerSummary.totalOutstanding) {
      toast.error('Payment amount cannot exceed the total supplier balance')
      return
    }
    if (!openPurchases.length) {
      toast.error('This supplier does not have any open invoice')
      return
    }

    ledgerPaymentMut.mutate({
      supplierName: ledgerSupplier.name,
      amount,
      paymentMethod: ledgerPaymentMethod,
      notes: ledgerPaymentNotes,
      purchases: openPurchases,
    })
  }

  const sendSupplierWhatsApp = (supplier, purchases = []) => {
    const url = createWhatsAppUrl(supplier.phone, buildSupplierWhatsAppMessage(supplier, purchases))
    if (!url) {
      toast.error('Supplier phone number is missing or invalid for WhatsApp')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (value, row) => (
        <div>
          <p className="font-medium text-slate-800">{value}</p>
          <p className="text-xs text-slate-400">{row.contact_person || 'No contact person saved'}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (value) => value || '-' },
    {
      key: 'purchase_count',
      label: 'Purchases',
      render: (value) => <span className="font-medium text-slate-700">{value}</span>,
    },
    {
      key: 'open_invoice_count',
      label: 'Open',
      render: (value) => <span className="font-medium text-amber-700">{value}</span>,
    },
    {
      key: 'pending_payable',
      label: 'Pending',
      render: (value) => (
        <span className={`font-medium ${toNumber(value) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {toCurrency(value)}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => <span className={`badge-${value ? 'healthy' : 'expired'}`}>{value ? 'Active' : 'Inactive'}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openLedger(row)}
            className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"
            title="Supplier Ledger"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => sendSupplierWhatsApp(row)}
            className="rounded p-1.5 text-sky-700 hover:bg-sky-50"
            title="WhatsApp Summary"
          >
            <MessageCircle size={14} />
          </button>
          {isStaff && (
            <button
              onClick={() => openEdit(row)}
              className="rounded p-1.5 text-slate-700 hover:bg-slate-50"
              title="Edit Supplier"
            >
              <Edit size={14} />
            </button>
          )}
          {isStaff && (
            <button
              onClick={() => setDeleteModal(row)}
              className="rounded p-1.5 text-red-500 hover:bg-red-50"
              title="Delete Supplier"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isStaff && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Supplier
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search suppliers..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No suppliers found."
      />

      <Modal
        open={!!ledgerSupplier}
        onClose={closeLedger}
        title={`Supplier Ledger: ${ledgerSupplier?.name || ''}`}
        size="xl"
      >
        {ledgerSupplier && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Supplier Account
                </p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">{ledgerSupplier.name}</h4>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Contact Person</p>
                    <p className="font-medium text-slate-800">{ledgerSupplier.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium text-slate-800">{ledgerSupplier.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-800">{ledgerSupplier.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Address</p>
                    <p className="font-medium text-slate-800">{ledgerSupplier.address || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Payable Totals
                </p>
                {ledgerLoading ? (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-4 animate-pulse rounded bg-emerald-100" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-emerald-700/80">Invoice History</p>
                      <p className="text-lg font-semibold text-slate-900">{ledgerSummary.totalInvoices}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Open Invoices</p>
                      <p className="text-lg font-semibold text-amber-700">{ledgerSummary.openInvoices}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Total Paid</p>
                      <p className="text-lg font-semibold text-sky-700">{toCurrency(ledgerSummary.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Total Pending</p>
                      <p className="text-lg font-semibold text-amber-700">{toCurrency(ledgerSummary.totalOutstanding)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Net Purchases</p>
                      <p className="font-semibold text-slate-900">{toCurrency(ledgerSummary.totalNetCost)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Returned</p>
                      <p className="font-semibold text-slate-900">{toCurrency(ledgerSummary.totalReturned)}</p>
                    </div>
                    {ledgerSummary.totalCredit > 0 && (
                      <div>
                        <p className="text-emerald-700/80">Supplier Credit</p>
                        <p className="font-semibold text-violet-700">{toCurrency(ledgerSummary.totalCredit)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-emerald-700/80">Pending / Partial</p>
                      <p className="font-semibold text-slate-900">
                        {ledgerSummary.pendingCount} / {ledgerSummary.partialCount}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Pay Supplier</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Record the amount paid now. It is applied against the oldest unpaid supplier invoices first.
                  </p>
                </div>
                <button
                  onClick={() => sendSupplierWhatsApp(ledgerSupplier, supplierPurchases)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <MessageCircle size={16} /> WhatsApp Summary
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,0.9fr,1.2fr,auto]">
                <div>
                  <label className="label">Amount Paid</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ledgerPaymentAmount}
                    onChange={(event) => setLedgerPaymentAmount(event.target.value)}
                    className="input"
                    placeholder={ledgerSummary.totalOutstanding > 0 ? toNumber(ledgerSummary.totalOutstanding).toFixed(2) : '0.00'}
                  />
                </div>
                <div>
                  <label className="label">Method</label>
                  <select
                    value={ledgerPaymentMethod}
                    onChange={(event) => setLedgerPaymentMethod(event.target.value)}
                    className="input"
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input
                    value={ledgerPaymentNotes}
                    onChange={(event) => setLedgerPaymentNotes(event.target.value)}
                    className="input"
                    placeholder="Cheque number, transfer reference, or settlement note"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={submitLedgerPayment}
                    disabled={ledgerPaymentMut.isPending || ledgerSummary.totalOutstanding <= 0}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CreditCard size={16} />
                    {ledgerPaymentMut.isPending ? 'Saving...' : 'Apply Payment'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Purchase History</h4>
                  <p className="text-xs text-slate-500">
                    Full supplier invoice history with paid and outstanding balances.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {ledgerData?.count || 0} invoice{(ledgerData?.count || 0) === 1 ? '' : 's'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Net Cost</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Outstanding</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerLoading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={index}>
                          <td colSpan={7} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    ) : supplierPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                          No purchase history found for this supplier.
                        </td>
                      </tr>
                    ) : (
                      supplierPurchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm text-slate-800">{purchase.po_number}</p>
                            <p className="text-xs text-slate-400">
                              {purchase.payments?.length || 0} payments / {purchase.returns?.length || 0} returns
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {format(new Date(purchase.purchase_date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {toCurrency(purchase.net_total_cost || purchase.total_cost)}
                          </td>
                          <td className="px-4 py-3 font-medium text-sky-700">
                            {toCurrency(purchase.total_paid_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${toNumber(purchase.outstanding_amount) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                              {toCurrency(purchase.outstanding_amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{paymentBadge(purchase.payment_status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => printInvoice(purchase.id)}
                                className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Print Purchase Invoice"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => printReceipt(purchase.id)}
                                className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Compact Receipt"
                              >
                                <Receipt size={14} />
                              </button>
                              {toNumber(purchase.outstanding_amount) > 0 && (
                                <button
                                  onClick={() => openInvoicePaymentModal(purchase)}
                                  className="rounded p-1.5 text-sky-700 hover:bg-sky-50"
                                  title="Record Payment"
                                >
                                  <Wallet size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editItem ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Supplier Name *</label>
            <input {...register('name')} className="input" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Person</label>
              <input {...register('contact_person')} className="input" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone')} className="input" />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Address</label>
            <textarea {...register('address')} className="input" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
              className="btn-primary flex-1"
            >
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editItem ? 'Update' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!invoicePaymentModal}
        onClose={closeInvoicePaymentModal}
        title={`Supplier Payment: ${invoicePaymentModal?.po_number || ''}`}
        size="sm"
      >
        {invoicePaymentModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Supplier</span>
                <span className="font-medium">{invoicePaymentModal.supplier_name || ledgerSupplier?.name}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-slate-600">Outstanding</span>
                <span className="font-semibold text-sky-700">{toCurrency(invoicePaymentModal.outstanding_amount)}</span>
              </div>
            </div>

            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={invoicePaymentAmount}
                onChange={(event) => setInvoicePaymentAmount(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                value={invoicePaymentMethod}
                onChange={(event) => setInvoicePaymentMethod(event.target.value)}
                className="input"
              >
                {paymentMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                value={invoicePaymentNotes}
                onChange={(event) => setInvoicePaymentNotes(event.target.value)}
                className="input"
                rows={3}
                placeholder="Cheque number, transfer reference, or supplier note"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={closeInvoicePaymentModal} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={submitInvoicePayment}
                disabled={invoicePaymentMut.isPending}
                className="btn-primary flex-1"
              >
                {invoicePaymentMut.isPending ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Supplier" size="sm">
        <p className="mb-4 text-sm text-gray-600">
          Delete <strong>{deleteModal?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => deleteMut.mutate(deleteModal.id)}
            disabled={deleteMut.isPending}
            className="btn-danger flex-1"
          >
            {deleteMut.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
