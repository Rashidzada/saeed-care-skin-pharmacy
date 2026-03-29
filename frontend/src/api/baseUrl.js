const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL

const normalizedApiBaseUrl =
  typeof rawApiBaseUrl === 'string' && rawApiBaseUrl.trim()
    ? rawApiBaseUrl.trim().replace(/\/+$/, '')
    : ''

export const API_BASE_ROOT =
  import.meta.env.DEV ? '' : normalizedApiBaseUrl

export const API_BASE_URL = `${API_BASE_ROOT}/api/v1`
