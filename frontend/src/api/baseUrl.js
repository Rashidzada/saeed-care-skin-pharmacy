const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL

export const API_BASE_ROOT =
  import.meta.env.DEV ? '' : (typeof rawApiBaseUrl === 'string' ? rawApiBaseUrl : 'http://localhost:8000')

export const API_BASE_URL = `${API_BASE_ROOT}/api/v1`

