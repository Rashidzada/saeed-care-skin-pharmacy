// G:/msms/frontend/src/pages/Users.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Edit, UserX, UserCheck } from 'lucide-react'
import api from '../api/axios'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const createSchema = z.object({
  username: z.string().min(3, 'Min 3 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['admin', 'staff', 'viewer']),
  password: z.string().min(6, 'Min 6 characters'),
  confirm_password: z.string().min(6),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

const editSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(['admin', 'staff', 'viewer']),
  is_active: z.boolean().optional(),
  password: z.string().min(6).optional().or(z.literal('')),
})

const getUsers = () => api.get('/auth/users/')
const createUser = (data) => api.post('/auth/users/', data)
const updateUser = (id, data) => api.patch(`/auth/users/${id}/`, data)
const deactivateUser = (id) => api.post(`/auth/users/${id}/deactivate/`)
const activateUser = (id) => api.post(`/auth/users/${id}/activate/`)

export default function Users() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers().then(r => r.data),
  })

  const schema = editItem ? editSchema : createSchema
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User created'); closeModal() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create user'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User updated'); closeModal() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update'),
  })

  const deactivateMut = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User deactivated') },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  const activateMut = useMutation({
    mutationFn: activateUser,
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User activated') },
  })

  const openAdd = () => { setEditItem(null); reset({ role: 'staff' }); setModalOpen(true) }
  const openEdit = (item) => { setEditItem(item); reset({ ...item, password: '' }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditItem(null) }

  const onSubmit = (data) => {
    const payload = { ...data }
    if (!payload.password) delete payload.password
    if (editItem) updateMut.mutate({ id: editItem.id, data: payload })
    else createMut.mutate(payload)
  }

  const roleBadge = (role) => {
    const map = {
      admin: 'bg-purple-100 text-purple-700',
      staff: 'bg-teal-100 text-teal-700',
      viewer: 'bg-gray-100 text-gray-600',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[role] || ''}`}>{role}</span>
  }

  const users = Array.isArray(data) ? data : (data?.results || [])

  const columns = [
    { key: 'username', label: 'Username', render: (v, row) => (
      <div>
        <p className="font-medium">{v}</p>
        <p className="text-xs text-gray-400">{row.full_name}</p>
      </div>
    )},
    { key: 'email', label: 'Email', render: (v) => v || '-' },
    { key: 'role', label: 'Role', render: (v) => roleBadge(v) },
    { key: 'is_active', label: 'Status', render: (v) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${v ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {v ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'created_at', label: 'Created', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row)} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"><Edit size={14} /></button>
          {row.id !== currentUser?.id && (
            row.is_active ? (
              <button onClick={() => deactivateMut.mutate(row.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Deactivate">
                <UserX size={14} />
              </button>
            ) : (
              <button onClick={() => activateMut.mutate(row.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Activate">
                <UserCheck size={14} />
              </button>
            )
          )}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add User</button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        searchable={false}
        emptyMessage="No users found."
      />

      <Modal open={modalOpen} onClose={closeModal} title={editItem ? 'Edit User' : 'Add User'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editItem && (
            <div>
              <label className="label">Username *</label>
              <input {...register('username')} className="input" placeholder="Username" />
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input {...register('first_name')} className="input" />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input {...register('last_name')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Role *</label>
            <select {...register('role')} className="input">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="label">{editItem ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input {...register('password')} type="password" className="input" placeholder={editItem ? 'Leave blank to keep current' : 'Min 6 characters'} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          {!editItem && (
            <div>
              <label className="label">Confirm Password *</label>
              <input {...register('confirm_password')} type="password" className="input" />
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editItem ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
