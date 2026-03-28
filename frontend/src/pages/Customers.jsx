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
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api/customers'
import {
  createSalePayment,
  getSaleInvoiceUrl,
  getSaleReceiptUrl,
  getSales,
} from '../api/sales'
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
  phone: z.string().min(7, 'Valid phone required'),
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

const sortSalesOldestFirst = (sales) =>
  [...sales].sort((left, right) => new Date(left.sale_date) - new Date(right.sale_date))

const buildCustomerWhatsAppMessage = (customer, sales = []) => {
  const openSales = sortSalesOldestFirst(
    sales.filter((sale) => toNumber(sale.outstanding_amount) > 0),
  )
  const totalSales = sales.length || toNumber(customer.purchase_count)
  const totalPaid = sales.length
    ? sales.reduce((sum, sale) => sum + toNumber(sale.total_paid_amount), 0)
    : toNumber(customer.total_paid_amount)
  const totalOutstanding = sales.length
    ? sales.reduce((sum, sale) => sum + toNumber(sale.outstanding_amount), 0)
    : toNumber(customer.pending_balance)

  const lines = [
    `Assalam o Alaikum ${customer.name},`,
    '',
    `This is ${BRAND.displayName}.`,
    '',
    'Your account summary is:',
    `- Total invoices: ${totalSales}`,
    `- Open invoices: ${openSales.length || toNumber(customer.open_invoice_count)}`,
    `- Total paid: ${toCurrency(totalPaid)}`,
    `- Total pending: ${toCurrency(totalOutstanding)}`,
  ]

  if (openSales.length) {
    lines.push('', 'Pending invoices:')
    openSales.slice(0, 12).forEach((sale) => {
      lines.push(
        `- ${sale.invoice_number} | ${format(new Date(sale.sale_date), 'dd MMM yyyy')} | Due ${toCurrency(sale.outstanding_amount)}`,
      )
    })
    if (openSales.length > 12) {
      lines.push(`- And ${openSales.length - 12} more open invoices`)
    }
  } else {
    lines.push('', 'You do not have any pending invoice right now.')
  }

  lines.push(
    '',
    'Please visit the pharmacy or reply here if you want to clear the balance in full or in parts.',
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

export default function Customers() {
  const { isStaff } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [ledgerCustomer, setLedgerCustomer] = useState(null)
  const [ledgerPaymentAmount, setLedgerPaymentAmount] = useState('')
  const [ledgerPaymentMethod, setLedgerPaymentMethod] = useState('cash')
  const [ledgerPaymentNotes, setLedgerPaymentNotes] = useState('')
  const [invoicePaymentModal, setInvoicePaymentModal] = useState(null)
  const [invoicePaymentAmount, setInvoicePaymentAmount] = useState('')
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('cash')
  const [invoicePaymentNotes, setInvoicePaymentNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => getCustomers({ page, search: search || undefined }).then((response) => response.data),
    keepPreviousData: true,
  })

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['customer-ledger', ledgerCustomer?.id],
    enabled: !!ledgerCustomer,
    queryFn: () => fetchAllResults(getSales, { customer: ledgerCustomer.id }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const customerSales = ledgerData?.results || []

  const ledgerSummary = useMemo(() => {
    const openSales = customerSales.filter((sale) => toNumber(sale.outstanding_amount) > 0)
    return {
      totalInvoices: customerSales.length,
      openInvoices: openSales.length,
      totalReturned: customerSales.reduce((sum, sale) => sum + toNumber(sale.returned_amount), 0),
      totalNetSales: customerSales.reduce(
        (sum, sale) => sum + toNumber(sale.net_total_amount || sale.total_amount),
        0,
      ),
      totalPaid: customerSales.reduce((sum, sale) => sum + toNumber(sale.total_paid_amount), 0),
      totalOutstanding: customerSales.reduce((sum, sale) => sum + toNumber(sale.outstanding_amount), 0),
      totalCredit: customerSales.reduce((sum, sale) => sum + toNumber(sale.credit_amount), 0),
      pendingCount: openSales.filter((sale) => sale.payment_status === 'pending').length,
      partialCount: openSales.filter((sale) => sale.payment_status === 'partial').length,
    }
  }, [customerSales])

  const openSales = useMemo(
    () => sortSalesOldestFirst(customerSales.filter((sale) => toNumber(sale.outstanding_amount) > 0)),
    [customerSales],
  )

  const invalidateOperationalQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['customer-ledger'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['report-daily'] })
    queryClient.invalidateQueries({ queryKey: ['report-monthly'] })
  }

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer added')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add customer'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data: payload }) => updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update customer'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deleted')
      setDeleteModal(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete customer'),
  })

  const invoicePaymentMut = useMutation({
    mutationFn: ({ id, payload }) => createSalePayment(id, payload),
    onSuccess: () => {
      invalidateOperationalQueries()
      toast.success('Customer payment recorded')
      closeInvoicePaymentModal()
    },
    onError: (err) => {
      const data = err.response?.data
      toast.error(data?.amount?.[0] || data?.sale?.[0] || data?.error || 'Failed to record payment')
    },
  })

  const ledgerPaymentMut = useMutation({
    mutationFn: async ({ customerName, amount, paymentMethod, notes, sales }) => {
      const allocations = []
      let remaining = Number(amount)

      for (const sale of sortSalesOldestFirst(sales.filter((entry) => toNumber(entry.outstanding_amount) > 0))) {
        if (remaining <= 0) {
          break
        }

        const allocation = Math.min(remaining, toNumber(sale.outstanding_amount))
        const paymentNotesText = [
          notes.trim(),
          `Ledger payment allocated from ${customerName}`,
        ].filter(Boolean).join(' | ')

        await createSalePayment(sale.id, {
          amount: Number(allocation.toFixed(2)),
          payment_method: paymentMethod,
          notes: paymentNotesText,
        })

        allocations.push({ invoiceNumber: sale.invoice_number, amount: allocation })
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
      toast.error(data?.amount?.[0] || data?.sale?.[0] || data?.error || 'Failed to apply payment')
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

  const openLedger = (customer) => {
    setLedgerCustomer(customer)
    setLedgerPaymentAmount('')
    setLedgerPaymentMethod('cash')
    setLedgerPaymentNotes('')
  }

  const closeLedger = () => {
    setLedgerCustomer(null)
    setLedgerPaymentAmount('')
    setLedgerPaymentMethod('cash')
    setLedgerPaymentNotes('')
  }

  const openInvoicePaymentModal = (sale) => {
    setInvoicePaymentModal(sale)
    setInvoicePaymentAmount(toNumber(sale.outstanding_amount).toFixed(2))
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
      toast.error('Payment amount cannot exceed the outstanding balance')
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
    if (!ledgerCustomer) {
      return
    }

    const amount = Number(ledgerPaymentAmount || 0)
    if (amount <= 0) {
      toast.error('Enter the amount received from the customer')
      return
    }
    if (amount > ledgerSummary.totalOutstanding) {
      toast.error('Payment amount cannot exceed the total pending balance')
      return
    }
    if (!openSales.length) {
      toast.error('This customer does not have any open invoice')
      return
    }

    ledgerPaymentMut.mutate({
      customerName: ledgerCustomer.name,
      amount,
      paymentMethod: ledgerPaymentMethod,
      notes: ledgerPaymentNotes,
      sales: openSales,
    })
  }

  const sendCustomerWhatsApp = (customer, sales = []) => {
    const url = createWhatsAppUrl(customer.phone, buildCustomerWhatsAppMessage(customer, sales))
    if (!url) {
      toast.error('Customer phone number is missing or invalid for WhatsApp')
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
          <p className="text-xs text-slate-400">{row.address || 'No address saved'}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (value) => value || '-' },
    {
      key: 'purchase_count',
      label: 'Sales',
      render: (value) => <span className="font-medium text-emerald-700">{value}</span>,
    },
    {
      key: 'open_invoice_count',
      label: 'Open',
      render: (value) => <span className="font-medium text-amber-700">{value}</span>,
    },
    {
      key: 'pending_balance',
      label: 'Pending',
      render: (value) => (
        <span className={`font-medium ${toNumber(value) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {toCurrency(value)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (value) => format(new Date(value), 'dd MMM yyyy'),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openLedger(row)}
            className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"
            title="Customer Ledger"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => sendCustomerWhatsApp(row)}
            className="rounded p-1.5 text-sky-700 hover:bg-sky-50"
            title="WhatsApp Summary"
          >
            <MessageCircle size={14} />
          </button>
          {isStaff && (
            <button
              onClick={() => openEdit(row)}
              className="rounded p-1.5 text-slate-700 hover:bg-slate-50"
              title="Edit Customer"
            >
              <Edit size={14} />
            </button>
          )}
          {isStaff && (
            <button
              onClick={() => setDeleteModal(row)}
              className="rounded p-1.5 text-red-500 hover:bg-red-50"
              title="Delete Customer"
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
            <Plus size={16} /> Add Customer
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
        searchPlaceholder="Search customers by name, phone..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No customers found."
      />

      <Modal
        open={!!ledgerCustomer}
        onClose={closeLedger}
        title={`Customer Ledger: ${ledgerCustomer?.name || ''}`}
        size="xl"
      >
        {ledgerCustomer && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Registered Customer
                </p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">{ledgerCustomer.name}</h4>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-medium text-slate-800">{ledgerCustomer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-800">{ledgerCustomer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Joined</p>
                    <p className="font-medium text-slate-800">
                      {format(new Date(ledgerCustomer.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Address</p>
                    <p className="font-medium text-slate-800">{ledgerCustomer.address || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Account Totals
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
                      <p className="text-emerald-700/80">Net Sales</p>
                      <p className="font-semibold text-slate-900">{toCurrency(ledgerSummary.totalNetSales)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700/80">Returned</p>
                      <p className="font-semibold text-slate-900">{toCurrency(ledgerSummary.totalReturned)}</p>
                    </div>
                    {ledgerSummary.totalCredit > 0 && (
                      <div>
                        <p className="text-emerald-700/80">Credit Due Back</p>
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
                  <h4 className="text-sm font-semibold text-slate-900">Collect Payment</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Record what the customer can pay now. The amount is applied against the oldest open invoices first.
                  </p>
                </div>
                <button
                  onClick={() => sendCustomerWhatsApp(ledgerCustomer, customerSales)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <MessageCircle size={16} /> WhatsApp Summary
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,0.9fr,1.2fr,auto]">
                <div>
                  <label className="label">Amount Received</label>
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
                    placeholder="Collector note, reference number, or agreement"
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
                  <h4 className="text-sm font-semibold text-slate-900">Invoice History</h4>
                  <p className="text-xs text-slate-500">
                    Full registered-customer history with payment and pending tracking.
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
                      <th className="px-4 py-3">Net Sale</th>
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
                    ) : customerSales.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                          No invoice history found for this customer.
                        </td>
                      </tr>
                    ) : (
                      customerSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm text-slate-800">{sale.invoice_number}</p>
                            <p className="text-xs text-slate-400">
                              {sale.payments?.length || 0} payments / {sale.returns?.length || 0} returns
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {format(new Date(sale.sale_date), 'dd MMM yyyy HH:mm')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {toCurrency(sale.net_total_amount || sale.total_amount)}
                          </td>
                          <td className="px-4 py-3 font-medium text-sky-700">
                            {toCurrency(sale.total_paid_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${toNumber(sale.outstanding_amount) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                              {toCurrency(sale.outstanding_amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{paymentBadge(sale.payment_status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => printInvoice(sale.id)}
                                className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Print Invoice"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => printReceipt(sale.id)}
                                className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Thermal Receipt"
                              >
                                <Receipt size={14} />
                              </button>
                              {toNumber(sale.outstanding_amount) > 0 && (
                                <button
                                  onClick={() => openInvoicePaymentModal(sale)}
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
        title={editItem ? 'Edit Customer' : 'Add Customer'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input {...register('name')} className="input" placeholder="Customer name" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone')} className="input" placeholder="+1-555-0000" />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
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
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editItem ? 'Update' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!invoicePaymentModal}
        onClose={closeInvoicePaymentModal}
        title={`Record Payment: ${invoicePaymentModal?.invoice_number || ''}`}
        size="sm"
      >
        {invoicePaymentModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Customer</span>
                <span className="font-medium">{invoicePaymentModal.customer_name || ledgerCustomer?.name}</span>
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
                placeholder="Partial payment note, reference number, or collector detail"
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

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Customer" size="sm">
        <p className="mb-4 text-sm text-gray-600">
          Delete customer <strong>{deleteModal?.name}</strong>?
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
