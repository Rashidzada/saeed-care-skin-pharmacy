// G:/msms/frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth'
import {
  refreshAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearStoredSession,
} from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount: try to restore session from refresh token
  useEffect(() => {
    const refresh = getRefreshToken()
    if (!refresh) {
      setLoading(false)
      return
    }

    let cancelled = false

    refreshAccessToken()
      .then(() => getMe())
      .then(({ data }) => {
        if (!cancelled) {
          setUser(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { data } = await apiLogin(credentials)
    setAccessToken(data.access)
    setRefreshToken(data.refresh)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    try {
      if (refresh) await apiLogout(refresh)
    } catch { /* ignore */ }
    clearStoredSession()
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff' || user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isStaff }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
