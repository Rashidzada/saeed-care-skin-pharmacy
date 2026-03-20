// G:/msms/frontend/src/pages/Customers.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api/customers'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Valid phone required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
})

export default function Customers() {
  const { isStaff } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => getCustomers({ page, search: search || undefined }).then(r => r.data),
    keepPreviousData: true,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => { queryClient.invalidateQueries(['customers']); toast.success('Customer added'); closeModal() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add customer'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateCustomer(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['customers']); toast.success('Customer updated'); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => { queryClient.invalidateQueries(['customers']); toast.success('Customer deleted'); setDeleteModal(null) },
  })

  const openAdd = () => { setEditItem(null); reset({}); setModalOpen(true) }
  const openEdit = (item) => { setEditItem(item); reset(item); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditItem(null) }

  const onSubmit = (data) => {
    if (editItem) updateMut.mutate({ id: editItem.id, data })
    else createMut.mutate(data)
  }

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (v) => v || '-' },
    { key: 'purchase_count', label: 'Purchases', render: (v) => <span className="text-emerald-700 font-medium">{v}</span> },
    { key: 'created_at', label: 'Joined', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    ...(isStaff ? [{
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"><Edit size={14} /></button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isStaff && <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Customer</button>}
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search customers by name, phone..."
        pagination={{ page, count: data?.count || 0, pageSize: 20 }}
        onPageChange={setPage}
        emptyMessage="No customers found."
      />

      <Modal open={modalOpen} onClose={closeModal} title={editItem ? 'Edit Customer' : 'Add Customer'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input {...register('name')} className="input" placeholder="Customer name" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone')} className="input" placeholder="+1-555-0000" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea {...register('address')} className="input" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editItem ? 'Update' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Customer" size="sm">
        <p className="text-gray-600 mb-4 text-sm">Delete customer <strong>{deleteModal?.name}</strong>?</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => deleteMut.mutate(deleteModal.id)} disabled={deleteMut.isPending} className="btn-danger flex-1">
            {deleteMut.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
