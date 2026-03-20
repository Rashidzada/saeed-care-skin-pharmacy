// G:/msms/frontend/src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Phone, ShieldCheck, ReceiptText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import { BRAND, BRAND_PHONES_TEXT } from '../config/branding'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await login(data)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        (err.request && !err.response
          ? 'Login request failed. Check that the backend is running and CORS allows this frontend origin.'
          : 'Invalid credentials. Please try again.')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,#ecfdf5_0%,#f8fafc_58%,#ecfeff_100%)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-emerald-100 bg-white/95 shadow-2xl shadow-emerald-950/10 backdrop-blur">
        <div className="grid lg:grid-cols-[1.05fr,0.95fr]">
          <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-800 via-teal-700 to-slate-900 px-10 py-12 text-white">
            <div>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-emerald-50">
                {BRAND.storeType}
              </span>
              <div className="mt-8">
                <BrandLogo variant="full" className="w-full max-w-[330px]" />
                <p className="mt-4 max-w-md text-sm leading-6 text-emerald-50/80">{BRAND.supportText}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/15">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-emerald-100" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Store Contact</p>
                    <p className="text-xs text-emerald-50/70">{BRAND.address}</p>
                    {BRAND.phones.map((phone) => (
                      <p key={phone} className="text-sm font-medium text-white">{phone}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <ShieldCheck size={18} className="text-emerald-100" />
                  <p className="mt-3 font-medium">Staff Access</p>
                  <p className="mt-1 text-xs text-emerald-50/70">Role-based sign in for admins and staff.</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <ReceiptText size={18} className="text-emerald-100" />
                  <p className="mt-3 font-medium">Daily Workflow</p>
                  <p className="mt-1 text-xs text-emerald-50/70">Sales, purchases, inventory, and reports.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 lg:hidden rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white shadow-lg shadow-emerald-950/10">
              <BrandLogo variant="full" className="w-full max-w-[270px]" />
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">{BRAND.shortName}</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">Sign in to continue</h2>
              <p className="mt-2 text-sm text-slate-500">{BRAND.supportText}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Username</label>
                <input
                  {...register('username')}
                  type="text"
                  placeholder="Enter your username"
                  className="input"
                  autoFocus
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Store Contact</p>
                <p className="mt-2 text-xs text-slate-500">{BRAND.address}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{BRAND_PHONES_TEXT}</p>
                <p className="mt-1 text-xs text-slate-500">Updated for invoices and visible store branding.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Demo Credentials</p>
                <p className="mt-2 text-xs text-slate-700">Admin: <code className="rounded bg-slate-200 px-1">admin</code> / <code className="rounded bg-slate-200 px-1">Admin@1234</code></p>
                <p className="mt-1 text-xs text-slate-700">Staff: <code className="rounded bg-slate-200 px-1">staff</code> / <code className="rounded bg-slate-200 px-1">Staff@1234</code></p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              {BRAND.legalName}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
