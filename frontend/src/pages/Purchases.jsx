// G:/msms/frontend/src/pages/Purchases.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, Eye, Printer, Trash2 } from 'lucide-react'
import { getPurchases, createPurchase, getPurchaseInvoiceUrl } from '../api/purchases'
import { getSuppliers } from '../api/suppliers'
import { getMedicines } from '../api/medicines'
import { getAccessToken } from '../api/axios'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { format } from 'date-fns'

export default function Purchases() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [viewModal, setViewModal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search],
    queryFn: () => getPurchases({ page, search: search || undefined }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => getSuppliers({ page_size: 100, active: 'true' }).then(r => r.data.results || r.data),
  })

  const { data: medData } = useQuery({
    queryKey: ['medicines-all-purchase'],
    queryFn: () => getMedicines({ page_size: 200 }).then(r => r.data.results || r.data),
  })

  const medicines = Array.isArray(medData) ? medData : (medData?.results || [])

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      supplier: '',
      purchase_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      notes: '',
      items: [{ medicine: '', quantity: 1, unit_cost: '', batch_number: '', expiry_date: '' }],
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const createMut = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries(['purchases'])
      queryClient.invalidateQueries(['medicines'])
      toast.success('Purchase recorded successfully')
      setCreateModal(false)
      reset()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to record purchase'),
  })

  const onSubmit = (data) => {
    createMut.mutate({
      ...data,
      supplier: Number(data.supplier),
      items: data.items.map(i => ({
        medicine: Number(i.medicine),
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        batch_number: i.batch_number || '',
        expiry_date: i.expiry_date || null,
      }))
    })
  }

  const printInvoice = (id) => {
    const url = getPurchaseInvoiceUrl(id)
    const token = getAccessToken()
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Failed to generate invoice'))
  }

  const columns = [
    { key: 'po_number', label: 'PO #', render: (v) => <span className="font-mono text-sm">{v}</span> },
    { key: 'purchase_date', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'invoice_number', label: 'Supplier Ref', render: (v) => v || '-' },
    { key: 'total_cost', label: 'Total Cost', render: (v) => <span className="font-semibold">PKR {Number(v).toFixed(2)}</span> },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewModal(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded">
            <Eye size={14} />
          </button>
          <button onClick={() => printInvoice(row.id)} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded">
            <Printer size={14} />
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Record Purchase
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by supplier, invoice number..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No purchases recorded."
      />

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); reset() }} title="Record New Purchase" size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier *</label>
              <select {...register('supplier', { required: 'Supplier is required' })} className="input">
                <option value="">Select supplier</option>
                {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {errors.supplier && <p className="text-red-500 text-xs mt-1">{errors.supplier.message}</p>}
            </div>
            <div>
              <label className="label">Purchase Date *</label>
              <input {...register('purchase_date', { required: true })} type="date" className="input" />
            </div>
            <div>
              <label className="label">Supplier Invoice #</label>
              <input {...register('invoice_number')} className="input" placeholder="Supplier's invoice reference" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input {...register('notes')} className="input" placeholder="Optional notes" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-sm text-gray-700">Line Items *</label>
              <button
                type="button"
                onClick={() => append({ medicine: '', quantity: 1, unit_cost: '', batch_number: '', expiry_date: '' })}
                className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 bg-gray-50 p-2 rounded-lg items-end">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Medicine</label>
                    <select {...register(`items.${idx}.medicine`, { required: true })} className="input text-xs">
                      <option value="">Select...</option>
                      {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Qty</label>
                    <input {...register(`items.${idx}.quantity`, { min: 1 })} type="number" min="1" className="input text-xs" placeholder="1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Unit Cost (PKR)</label>
                    <input {...register(`items.${idx}.unit_cost`, { required: true })} type="number" step="0.01" className="input text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Batch #</label>
                    <input {...register(`items.${idx}.batch_number`)} className="input text-xs" placeholder="Optional" />
                  </div>
                  <div className="flex gap-1 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Expiry</label>
                      <input {...register(`items.${idx}.expiry_date`)} type="date" className="input text-xs" />
                    </div>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded mb-0.5">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setCreateModal(false); reset() }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">
              {createMut.isPending ? 'Recording...' : 'Record Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title={`Purchase: ${viewModal?.po_number}`} size="lg">
        {viewModal && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">Supplier: </span><strong>{viewModal.supplier_name}</strong></div>
              <div><span className="text-gray-500">Date: </span><strong>{format(new Date(viewModal.purchase_date), 'dd MMM yyyy')}</strong></div>
              <div><span className="text-gray-500">Recorded by: </span><strong>{viewModal.recorded_by_name}</strong></div>
              {viewModal.invoice_number && <div><span className="text-gray-500">Ref: </span><strong>{viewModal.invoice_number}</strong></div>}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50"><th className="text-left p-2 text-xs">Medicine</th><th className="p-2 text-xs">Batch</th><th className="p-2 text-xs">Expiry</th><th className="text-right p-2 text-xs">Qty</th><th className="text-right p-2 text-xs">Unit Cost</th><th className="text-right p-2 text-xs">Total</th></tr></thead>
              <tbody>
                {(viewModal.items || []).map(item => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="p-2">{item.medicine_name}</td>
                    <td className="p-2">{item.batch_number || '-'}</td>
                    <td className="p-2">{item.expiry_date || '-'}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">PKR {Number(item.unit_cost).toFixed(2)}</td>
                    <td className="p-2 text-right font-medium">PKR {(Number(item.unit_cost) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
                <tr><td colSpan={5} className="p-2 text-right font-bold">Total Cost</td><td className="p-2 text-right font-bold text-green-700">PKR {Number(viewModal.total_cost).toFixed(2)}</td></tr>
              </tbody>
            </table>
            <button onClick={() => printInvoice(viewModal.id)} className="btn-secondary w-full flex items-center justify-center gap-2">
              <Printer size={16} /> Print Purchase Order
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
