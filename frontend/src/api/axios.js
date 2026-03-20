// G:/msms/frontend/src/api/axios.js
import axios from 'axios'
import { API_BASE_URL } from './baseUrl'

// In-memory token store (not localStorage for security)
let accessToken = null
let refreshRequest = null
const REFRESH_STORAGE_KEY = 'msms_refresh'

export const setAccessToken = (token) => { accessToken = token }
export const getAccessToken = () => accessToken
export const clearAccessToken = () => { accessToken = null }
export const getRefreshToken = () => localStorage.getItem(REFRESH_STORAGE_KEY)
export const setRefreshToken = (token) => {
  if (token) {
    localStorage.setItem(REFRESH_STORAGE_KEY, token)
  }
}
export const clearStoredSession = () => {
  clearAccessToken()
  localStorage.removeItem(REFRESH_STORAGE_KEY)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

export const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')

  if (!refreshRequest) {
    refreshRequest = axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken })
      .then(({ data }) => {
        setAccessToken(data.access)
        if (data.refresh) {
          setRefreshToken(data.refresh)
        }
        return data
      })
      .catch((error) => {
        clearAccessToken()
        if (error.response?.status) {
          localStorage.removeItem(REFRESH_STORAGE_KEY)
        }
        throw error
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

// Request interceptor: attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 and try refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { access } = await refreshAccessToken()
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch {
        clearStoredSession()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
