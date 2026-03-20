// G:/msms/frontend/src/api/sales.js
import api from './axios'
import { API_BASE_URL } from './baseUrl'

export const getSales = (params) => api.get('/sales/', { params })
export const getSale = (id) => api.get(`/sales/${id}/`)
export const createSale = (data) => api.post('/sales/', data)
export const voidSale = (id) => api.post(`/sales/${id}/void/`)
export const getSaleInvoiceUrl = (id) => `${API_BASE_URL}/sales/${id}/invoice/`
