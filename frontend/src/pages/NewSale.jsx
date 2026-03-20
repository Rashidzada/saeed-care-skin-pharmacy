// G:/msms/frontend/src/pages/NewSale.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CheckCircle, Printer, User
} from 'lucide-react'
import { getMedicines } from '../api/medicines'
import { getCustomers, createCustomer } from '../api/customers'
import { createSale, getSaleInvoiceUrl } from '../api/sales'
import { getAccessToken } from '../api/axios'
import Modal from '../components/Modal'

export default function NewSale() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [medSearch, setMedSearch] = useState('')
  const [cart, setCart] = useState([])
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState('paid')
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
      queryClient.invalidateQueries(['medicines'])
      queryClient.invalidateQueries(['sales'])
      queryClient.invalidateQueries(['dashboard-stats'])
      setCreatedSale(res.data)
      setConfirmModal(false)
      setSuccessModal(true)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create sale'),
  })

  const medicines = medData?.results || []
  const customers = custData?.results || []

  const addToCart = (med) => {
    if (med.quantity === 0) {
      toast.error(`${med.name} is out of stock`)
      return
    }
    const existing = cart.find(i => i.medicine_id === med.id)
    if (existing) {
      if (existing.quantity >= med.quantity) {
        toast.error(`Only ${med.quantity} units available`)
        return
      }
      setCart(cart.map(i =>
        i.medicine_id === med.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setCart([...cart, {
        medicine_id: med.id,
        name: med.name,
        unit_price: Number(med.unit_price),
        quantity: 1,
        max_quantity: med.quantity,
      }])
    }
    setMedSearch('')
  }

  const updateQty = (id, delta) => {
    setCart(cart.map(i => {
      if (i.medicine_id !== id) return i
      const newQty = i.quantity + delta
      if (newQty <= 0) return null
      if (newQty > i.max_quantity) {
        toast.error(`Only ${i.max_quantity} units available`)
        return i
      }
      return { ...i, quantity: newQty }
    }).filter(Boolean))
  }

  const removeFromCart = (id) => setCart(cart.filter(i => i.medicine_id !== id))

  const subtotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const taxAmount = (subtotal * taxRate) / 100
  const grandTotal = Math.max(subtotal + taxAmount - Number(discount), 0)

  const confirmSale = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setConfirmModal(true)
  }

  const completeSale = () => {
    saleMut.mutate({
      customer: selectedCustomer?.id || null,
      items: cart.map(i => ({
        medicine: i.medicine_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      tax_rate: taxRate,
      discount: Number(discount),
      payment_status: paymentStatus,
      notes,
    })
  }

  const printInvoice = () => {
    if (!createdSale) return
    const url = getSaleInvoiceUrl(createdSale.id)
    const token = getAccessToken()
    // Open invoice with token in header via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
      })
      .catch(() => toast.error('Failed to generate invoice'))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
      {/* Left: Medicine Search */}
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
              onChange={e => setMedSearch(e.target.value)}
              placeholder="Type medicine name, batch number..."
              className="input pl-9"
              autoFocus
            />
          </div>

          {medicines.length > 0 && medSearch && (
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {medicines.map(med => (
                <div
                  key={med.id}
                  className={`flex items-center justify-between p-3 hover:bg-emerald-50 cursor-pointer transition-colors ${med.quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => addToCart(med)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{med.name}</p>
                    <p className="text-xs text-gray-400">
                      Batch: {med.batch_number} | Expiry: {med.expiry_date} | Stock: {med.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-700">PKR {Number(med.unit_price).toFixed(2)}</p>
                    <button className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded mt-0.5">
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer select */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <User size={18} className="text-emerald-700" /> Customer (Optional)
          </h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-green-800">{selectedCustomer.name}</p>
                <p className="text-xs text-green-600">{selectedCustomer.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-red-500 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search customer by name or phone..."
                className="input pl-9"
              />
              {customers.length > 0 && customerSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {customers.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50 cursor-pointer"
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch('') }}
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">Leave empty for walk-in customer</p>
        </div>

        {/* Sale settings */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Sale Settings</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Tax Rate (%)</label>
              <input
                type="number" min="0" max="100" step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Discount (PKR)</label>
              <input
                type="number" min="0" step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="input">
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows={2} placeholder="Any notes..." />
          </div>
        </div>
      </div>

      {/* Right: Cart */}
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
              {cart.map(item => (
                <div key={item.medicine_id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">PKR {item.unit_price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.medicine_id, -1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700">
                      <Minus size={10} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.medicine_id, 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700">
                      <Plus size={10} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 w-16 text-right">
                    PKR {(item.unit_price * item.quantity).toFixed(2)}
                  </p>
                  <button onClick={() => removeFromCart(item.medicine_id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-gray-200 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>PKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({taxRate}%)</span><span>PKR {taxAmount.toFixed(2)}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span><span>-PKR {Number(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-200 pt-2 mt-2">
              <span>Grand Total</span><span className="text-emerald-700">PKR {grandTotal.toFixed(2)}</span>
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

      {/* Confirm Modal */}
      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Sale" size="sm">
        <div className="space-y-3 mb-4">
          <p className="text-gray-600 text-sm">Review before completing the sale:</p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Items</span><span className="font-medium">{cart.length}</span></div>
            <div className="flex justify-between"><span>Customer</span><span className="font-medium">{selectedCustomer?.name || 'Walk-in'}</span></div>
            <div className="flex justify-between text-emerald-700 font-bold text-base border-t border-gray-200 pt-2 mt-2">
              <span>Total</span><span>PKR {grandTotal.toFixed(2)}</span>
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

      {/* Success Modal */}
      <Modal open={successModal} onClose={() => { setSuccessModal(false); navigate('/sales') }} title="Sale Completed" size="sm">
        <div className="text-center py-4 space-y-3">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-800">Sale Completed Successfully!</h3>
          <p className="text-sm text-gray-500">Invoice: <strong>{createdSale?.invoice_number}</strong></p>
          <p className="text-xl font-bold text-emerald-700">PKR {Number(createdSale?.total_amount || 0).toFixed(2)}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={printInvoice}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Print Invoice
          </button>
          <button
            onClick={() => {
              setSuccessModal(false)
              setCart([])
              setSelectedCustomer(null)
              setNotes('')
            }}
            className="btn-primary flex-1"
          >
            New Sale
          </button>
        </div>
      </Modal>
    </div>
  )
}
