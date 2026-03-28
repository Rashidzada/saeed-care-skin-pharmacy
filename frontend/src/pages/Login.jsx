// G:/msms/frontend/src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import { BRAND } from '../config/branding'

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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.12),transparent_28%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),transparent_24%),linear-gradient(180deg,#fcfdff_0%,#f4f7fb_100%)] px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute bottom-20 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="relative w-full max-w-[23rem] pt-16 sm:max-w-[25rem] sm:pt-20">
          <div className="absolute left-1/2 top-0 z-10 w-32 -translate-x-1/2 drop-shadow-[0_20px_32px_rgba(15,118,110,0.18)] sm:w-36">
            <BrandLogo variant="mark" className="w-full" />
          </div>

          <div className="rounded-[30px] border border-white/80 bg-white/92 px-6 pb-7 pt-16 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur sm:px-8 sm:pb-8 sm:pt-20">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
                Sign in to continue
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {BRAND.supportText}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
                <input
                  {...register('username')}
                  type="text"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-base text-slate-800 shadow-inner shadow-slate-100 transition-all focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  autoFocus
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 pr-11 text-base text-slate-800 shadow-inner shadow-slate-100 transition-all focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-lg font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all hover:from-emerald-700 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              {BRAND.legalName}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
