// G:/msms/frontend/src/pages/Medicines.jsx
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, Package, AlertTriangle, Clock, XCircle } from 'lucide-react'
import { getMedicines, createMedicine, updateMedicine, deleteMedicine } from '../api/medicines'
import { getSuppliers } from '../api/suppliers'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  generic_name: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  unit_price: z.coerce.number().positive('Price must be positive'),
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  min_stock_threshold: z.coerce.number().int().min(0),
  supplier: z.coerce.number().optional().nullable(),
  description: z.string().optional(),
})

const CATEGORIES = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'powder', 'other']
const FILTERS = ['all', 'low_stock', 'near_expiry', 'expired']

export default function Medicines() {
  const { isStaff } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [editItem, setEditItem] = useState(null)

  const buildParams = () => {
    const p = { page, page_size: 20 }
    if (search) p.search = search
    return p
  }

  const { data, isLoading } = useQuery({
    queryKey: ['medicines', page, search, filter],
    queryFn: () => getMedicines(buildParams()).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => getSuppliers({ page_size: 100, active: 'true' }).then(r => r.data.results || r.data),
  })

  const createMut = useMutation({
    mutationFn: createMedicine,
    onSuccess: () => {
      queryClient.invalidateQueries(['medicines'])
      toast.success('Medicine added successfully')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add medicine'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateMedicine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['medicines'])
      toast.success('Medicine updated successfully')
      closeModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update medicine'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteMedicine,
    onSuccess: () => {
      queryClient.invalidateQueries(['medicines'])
      toast.success('Medicine removed')
      setDeleteModal(null)
    },
    onError: () => toast.error('Failed to remove medicine'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const openAdd = () => {
    setEditItem(null)
    reset({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({
      ...item,
      expiry_date: item.expiry_date,
      supplier: item.supplier || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditItem(null)
  }

  const onSubmit = (data) => {
    const payload = { ...data, supplier: data.supplier || null }
    if (editItem) {
      updateMut.mutate({ id: editItem.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const handleSearch = useCallback((val) => {
    setSearch(val)
    setPage(1)
  }, [])

  // Filter data client-side
  const allMedicines = data?.results || []
  const filteredMedicines = allMedicines.filter(m => {
    if (filter === 'low_stock') return m.is_low_stock
    if (filter === 'near_expiry') return m.status === 'near_expiry'
    if (filter === 'expired') return m.is_expired
    return true
  })

  const statusBadge = (status) => {
    const map = {
      healthy: 'badge-healthy',
      low_stock: 'badge-low',
      near_expiry: 'badge-near',
      expired: 'badge-expired',
      out_of_stock: 'badge-expired',
    }
    const labels = {
      healthy: 'Healthy', low_stock: 'Low Stock', near_expiry: 'Near Expiry',
      expired: 'Expired', out_of_stock: 'Out of Stock',
    }
    return <span className={map[status] || ''}>{labels[status] || status}</span>
  }

  const columns = [
    { key: 'name', label: 'Name', render: (v, row) => (
      <div>
        <p className="font-medium text-gray-800">{v}</p>
        {row.generic_name && <p className="text-xs text-gray-400">{row.generic_name}</p>}
      </div>
    )},
    { key: 'category', label: 'Category', render: (v) => <span className="capitalize text-sm">{v}</span> },
    { key: 'batch_number', label: 'Batch' },
    { key: 'expiry_date', label: 'Expiry' },
    { key: 'unit_price', label: 'Price', render: (v) => `PKR ${Number(v).toFixed(2)}` },
    { key: 'quantity', label: 'Stock', render: (v, row) => (
      <span className={v <= row.min_stock_threshold ? 'text-red-600 font-semibold' : 'text-gray-700'}>{v}</span>
    )},
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    ...(isStaff ? [{
      key: 'actions', label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded">
            <Edit size={14} />
          </button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      )
    }] : []),
  ]

  const rowClassName = (row) => {
    if (row.is_expired || row.quantity === 0) return 'bg-red-50'
    if (row.status === 'near_expiry') return 'bg-orange-50'
    if (row.is_low_stock) return 'bg-yellow-50'
    return ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filter === f
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
              }`}
            >
              {f === 'all' ? 'All' : f === 'low_stock' ? 'Low Stock' : f === 'near_expiry' ? 'Near Expiry' : 'Expired'}
            </button>
          ))}
        </div>
        {isStaff && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Medicine
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredMedicines}
        loading={isLoading}
        onSearch={handleSearch}
        searchPlaceholder="Search by name, batch, manufacturer..."
        rowClassName={rowClassName}
        pagination={{
          page,
          count: data?.count || 0,
          pageSize: 20,
        }}
        onPageChange={setPage}
        emptyMessage="No medicines found."
      />

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editItem ? 'Edit Medicine' : 'Add New Medicine'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Medicine Name *</label>
              <input {...register('name')} className="input" placeholder="e.g. Paracetamol 500mg" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Generic Name</label>
              <input {...register('generic_name')} className="input" placeholder="Generic/chemical name" />
            </div>
            <div>
              <label className="label">Category *</label>
              <select {...register('category')} className="input">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
            </div>
            <div>
              <label className="label">Manufacturer *</label>
              <input {...register('manufacturer')} className="input" placeholder="Manufacturer name" />
              {errors.manufacturer && <p className="text-red-500 text-xs mt-1">{errors.manufacturer.message}</p>}
            </div>
            <div>
              <label className="label">Batch Number *</label>
              <input {...register('batch_number')} className="input" placeholder="e.g. PCM-2024-001" />
              {errors.batch_number && <p className="text-red-500 text-xs mt-1">{errors.batch_number.message}</p>}
            </div>
            <div>
              <label className="label">Expiry Date *</label>
              <input {...register('expiry_date')} type="date" className="input" />
              {errors.expiry_date && <p className="text-red-500 text-xs mt-1">{errors.expiry_date.message}</p>}
            </div>
            <div>
              <label className="label">Unit Price (PKR) *</label>
              <input {...register('unit_price')} type="number" step="0.01" className="input" placeholder="0.00" />
              {errors.unit_price && <p className="text-red-500 text-xs mt-1">{errors.unit_price.message}</p>}
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input {...register('quantity')} type="number" className="input" placeholder="0" />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="label">Min Stock Threshold</label>
              <input {...register('min_stock_threshold')} type="number" className="input" placeholder="10" />
            </div>
            <div>
              <label className="label">Supplier</label>
              <select {...register('supplier')} className="input">
                <option value="">Select supplier (optional)</option>
                {(suppliers || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea {...register('description')} className="input" rows={2} placeholder="Optional notes..." />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
              className="btn-primary flex-1"
            >
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editItem ? 'Update Medicine' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Remove Medicine" size="sm">
        <p className="text-gray-600 mb-4">
          Are you sure you want to remove <strong>{deleteModal?.name}</strong>? This will deactivate the medicine.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => deleteMut.mutate(deleteModal.id)}
            disabled={deleteMut.isPending}
            className="btn-danger flex-1"
          >
            {deleteMut.isPending ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
