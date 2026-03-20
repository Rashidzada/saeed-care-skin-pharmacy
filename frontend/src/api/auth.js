// G:/msms/frontend/src/api/auth.js
import api from './axios'

export const login = (credentials) => api.post('/auth/login/', credentials)
export const logout = (refresh) => api.post('/auth/logout/', { refresh })
export const getMe = () => api.get('/auth/me/')
