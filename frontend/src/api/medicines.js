// G:/msms/frontend/src/api/medicines.js
import api from './axios'

export const getMedicines = (params) => api.get('/medicines/', { params })
export const getMedicine = (id) => api.get(`/medicines/${id}/`)
export const createMedicine = (data) => api.post('/medicines/', data)
export const updateMedicine = (id, data) => api.patch(`/medicines/${id}/`, data)
export const deleteMedicine = (id) => api.delete(`/medicines/${id}/`)
export const getLowStock = () => api.get('/medicines/low-stock/')
export const getNearExpiry = (days = 30) => api.get('/medicines/near-expiry/', { params: { days } })
export const getAlertsSummary = () => api.get('/medicines/alerts-summary/')
