import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CheckCircle, Printer, Receipt, User
} from 'lucide-react'

import { getMedicines } from '../api/medicines'
import { getCustomers } from '../api/customers'
import {
  createSale,
  getSaleInvoiceUrl,
  getSaleReceiptUrl,
} from '../api/sales'
import { getAccessToken } from '../api/axios'
import Modal from '../components/Modal'

const toCurrency = (value) => `PKR ${Number(value || 0).toFixed(2)}`

export default function NewSale() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [medSearch, setMedSearch] = useState('')
  const [cart, setCart] = useState([])
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [confirmModal, setConfirmModal] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [createdSale, setCreatedSale] = useState(null)
  const [notes, setNotes] = useState('')

  const { data: medData } = useQuery({
    queryKey: ['medicines-search', medSearch],
    queryFn: () => getMedicines({ search: medSearch, page_size: 20 }).then(r => r.data),
    enabled: medSearch.length >= 1,
  })

  const { data: custData } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => getCustomers({ search: customerSearch, page_size: 20 }).then(r => r.data),
    enabled: customerSearch.length >= 1,
  })

  const saleMut = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setCreatedSale(res.data)
      setConfirmModal(false)
      setSuccessModal(true)
    },
    onError: (err) => {
      const data = err.response?.data
      const message = typeof data === 'string'
        ? data
        : data?.amount_paid?.[0] || data?.customer?.[0] || data?.error || 'Failed to create sale'
      toast.error(message)
    },
  })

  const medicines = medData?.results || []
  const customers = custData?.results || []

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const taxAmount = (subtotal * taxRate) / 100
  const grandTotal = Math.max(subtotal + taxAmount - Number(discount), 0)
  const normalizedAmountPaid = Math.max(
    0,
    Math.min(Number(amountPaid || 0), grandTotal),
  )
  const outstandingBalance = Math.max(grandTotal - normalizedAmountPaid, 0)

  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(grandTotal ? grandTotal.toFixed(2) : '0.00')
      return
    }

    if (paymentStatus === 'pending') {
      setAmountPaid('0.00')
      return
    }

    if (Number(amountPaid || 0) >= grandTotal) {
      setAmountPaid('')
    }
  }, [grandTotal, paymentStatus])

  const addToCart = (medicine) => {
    if (medicine.quantity === 0) {
      toast.error(`${medicine.name} is out of stock`)
      return
    }

    const existing = cart.find((item) => item.medicine_id === medicine.id)
    if (existing) {
      if (existing.quantity >= medicine.quantity) {
        toast.error(`Only ${medicine.quantity} units available`)
        return
      }
      setCart(
        cart.map((item) =>
          item.medicine_id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      )
    } else {
      setCart([
        ...cart,
        {
          medicine_id: medicine.id,
          name: medicine.name,
          unit_price: Number(medicine.unit_price),
          quantity: 1,
          max_quantity: medicine.quantity,
        },
      ])
    }
    setMedSearch('')
  }

  const updateQty = (id, delta) => {
    setCart(
      cart
        .map((item) => {
          if (item.medicine_id !== id) {
            return item
          }

          const newQty = item.quantity + delta
          if (newQty <= 0) {
            return null
          }
          if (newQty > item.max_quantity) {
            toast.error(`Only ${item.max_quantity} units available`)
            return item
          }
          return { ...item, quantity: newQty }
        })
        .filter(Boolean),
    )
  }

  const removeFromCart = (id) => setCart(cart.filter((item) => item.medicine_id !== id))

  const ensurePaymentRules = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return false
    }

    if (normalizedAmountPaid > grandTotal) {
      toast.error('Amount paid cannot exceed the sale total')
      return false
    }

    if (paymentStatus === 'paid' && outstandingBalance > 0) {
      toast.error('Paid sales must have the full amount collected')
      return false
    }

    if (paymentStatus === 'pending' && normalizedAmountPaid > 0) {
      toast.error('Pending sales should not have a payment recorded. Use partial instead.')
      return false
    }

    if (paymentStatus === 'partial' && (normalizedAmountPaid <= 0 || normalizedAmountPaid >= grandTotal)) {
      toast.error('Partial payment must be more than zero and less than the net total')
      return false
    }

    if (outstandingBalance > 0 && !selectedCustomer) {
      toast.error('Select a registered customer for pending or partial sales')
      return false
    }

    return true
  }

  const confirmSale = () => {
    if (!ensurePaymentRules()) {
      return
    }
    setConfirmModal(true)
  }

  const completeSale = () => {
    saleMut.mutate({
      customer: selectedCustomer?.id || null,
      items: cart.map((item) => ({
        medicine: item.medicine_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      tax_rate: taxRate,
      discount: Number(discount),
      payment_status: paymentStatus,
      amount_paid: normalizedAmountPaid,
      payment_method: paymentMethod,
      payment_notes: normalizedAmountPaid > 0 ? 'Initial payment recorded at the time of sale.' : '',
      notes,
    })
  }

  const openProtectedDocument = (url) => {
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
      })
      .catch(() => toast.error('Failed to generate document'))
  }

  const printInvoice = () => {
    if (!createdSale) {
      return
    }
    openProtectedDocument(getSaleInvoiceUrl(createdSale.id))
  }

  const printThermalReceipt = () => {
    if (!createdSale) {
      return
    }
    openProtectedDocument(getSaleReceiptUrl(createdSale.id))
  }

  const resetSaleForm = () => {
    setSuccessModal(false)
    setCart([])
    setSelectedCustomer(null)
    setCustomerSearch('')
    setNotes('')
    setPaymentStatus('paid')
    setPaymentMethod('cash')
    setAmountPaid('')
    setTaxRate(0)
    setDiscount(0)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
      <div className="lg:col-span-3 space-y-4">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Search size={18} className="text-emerald-700" /> Search Medicines
          </h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={medSearch}
              onChange={(event) => setMedSearch(event.target.value)}
              placeholder="Type medicine name, batch number..."
              className="input pl-9"
              autoFocus
            />
          </div>

          {medicines.length > 0 && medSearch && (
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {medicines.map((medicine) => (
                <div
                  key={medicine.id}
                  className={`flex items-center justify-between p-3 hover:bg-emerald-50 cursor-pointer transition-colors ${medicine.quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => addToCart(medicine)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{medicine.name}</p>
                    <p className="text-xs text-gray-400">
                      Batch: {medicine.batch_number} | Expiry: {medicine.expiry_date} | Stock: {medicine.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-700">{toCurrency(medicine.unit_price)}</p>
                    <button className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded mt-0.5">
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <User size={18} className="text-emerald-700" /> Customer
          </h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-green-800">{selectedCustomer.name}</p>
                <p className="text-xs text-green-600">{selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer by name or phone..."
                className="input pl-9"
              />
              {customers.length > 0 && customerSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50 cursor-pointer"
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setCustomerSearch('')
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-gray-400">{customer.phone}</p>
                      </div>
                      {Number(customer.pending_balance || 0) > 0 && (
                        <span className="text-xs rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                          Due {toCurrency(customer.pending_balance)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Walk-in is allowed for paid sales. Pending or partial sales must use a registered customer.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Sale Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="label">Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Discount (PKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value)}
                className="input"
              >
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Amount Paid Now (PKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className="input"
                placeholder={paymentStatus === 'partial' ? 'Enter received amount' : '0.00'}
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave this at zero for full pending credit. For fully paid sales it auto-fills the net total.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Net Total</span>
                <span className="font-semibold">{toCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-500">Paid Now</span>
                <span className="font-semibold text-emerald-700">{toCurrency(normalizedAmountPaid)}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-500">Balance Due</span>
                <span className={`font-semibold ${outstandingBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {toCurrency(outstandingBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="label">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="input"
              rows={2}
              placeholder="Payment note, doctor reference, or invoice note..."
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="card sticky top-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-700" />
            Cart
            <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.length} items
            </span>
          </h3>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Search and add medicines</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
              {cart.map((item) => (
                <div key={item.medicine_id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{toCurrency(item.unit_price)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.medicine_id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.medicine_id, 1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 w-16 text-right">
                    {toCurrency(item.unit_price * item.quantity)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.medicine_id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-200 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{toCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({taxRate}%)</span><span>{toCurrency(taxAmount)}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span><span>-{toCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-200 pt-2 mt-2">
              <span>Grand Total</span><span className="text-emerald-700">{toCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Paid Now</span><span>{toCurrency(normalizedAmountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Balance Due</span>
              <span className={outstandingBalance > 0 ? 'text-amber-700' : 'text-green-700'}>
                {toCurrency(outstandingBalance)}
              </span>
            </div>
          </div>

          <button
            onClick={confirmSale}
            disabled={cart.length === 0}
            className="btn-primary w-full mt-4 py-3 text-base font-semibold"
          >
            Complete Sale
          </button>
        </div>
      </div>

      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Sale" size="sm">
        <div className="space-y-3 mb-4">
          <p className="text-gray-600 text-sm">Review before completing the sale:</p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Items</span><span className="font-medium">{cart.length}</span></div>
            <div className="flex justify-between"><span>Customer</span><span className="font-medium">{selectedCustomer?.name || 'Walk-in'}</span></div>
            <div className="flex justify-between"><span>Payment</span><span className="font-medium capitalize">{paymentStatus}</span></div>
            <div className="flex justify-between"><span>Paid Now</span><span className="font-medium">{toCurrency(normalizedAmountPaid)}</span></div>
            <div className="flex justify-between"><span>Balance Due</span><span className={`font-medium ${outstandingBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>{toCurrency(outstandingBalance)}</span></div>
            <div className="flex justify-between text-emerald-700 font-bold text-base border-t border-gray-200 pt-2 mt-2">
              <span>Total</span><span>{toCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfirmModal(false)} className="btn-secondary flex-1">Back</button>
          <button
            onClick={completeSale}
            disabled={saleMut.isPending}
            className="btn-success flex-1"
          >
            {saleMut.isPending ? 'Processing...' : 'Confirm & Complete'}
          </button>
        </div>
      </Modal>

      <Modal open={successModal} onClose={() => { setSuccessModal(false); navigate('/sales') }} title="Sale Completed" size="sm">
        <div className="text-center py-4 space-y-3">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-800">Sale Completed Successfully</h3>
          <p className="text-sm text-gray-500">Invoice: <strong>{createdSale?.invoice_number}</strong></p>
          <p className="text-xl font-bold text-emerald-700">{toCurrency(createdSale?.net_total_amount || createdSale?.total_amount || 0)}</p>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Paid</span>
              <span className="font-medium">{toCurrency(createdSale?.total_paid_amount || 0)}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-500">Outstanding</span>
              <span className={`font-medium ${Number(createdSale?.outstanding_amount || 0) > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {toCurrency(createdSale?.outstanding_amount || 0)}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={printInvoice}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Full Invoice
          </button>
          <button
            onClick={printThermalReceipt}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Receipt size={16} /> Thermal Receipt
          </button>
          <button onClick={resetSaleForm} className="btn-primary">
            New Sale
          </button>
        </div>
      </Modal>
    </div>
  )
}
