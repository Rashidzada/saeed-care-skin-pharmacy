// G:/msms/frontend/src/api/purchases.js
import api from './axios'
import { API_BASE_URL } from './baseUrl'

export const getPurchases = (params) => api.get('/purchases/', { params })
export const getPurchase = (id) => api.get(`/purchases/${id}/`)
export const createPurchase = (data) => api.post('/purchases/', data)
export const updatePurchase = (id, data) => api.patch(`/purchases/${id}/`, data)
export const createPurchaseReturn = (id, data) => api.post(`/purchases/${id}/returns/`, data)
export const createPurchasePayment = (id, data) => api.post(`/purchases/${id}/payments/`, data)
export const getPurchaseInvoiceUrl = (id) => `${API_BASE_URL}/purchases/${id}/invoice/`
export const getPurchaseReceiptUrl = (id) => `${API_BASE_URL}/purchases/${id}/receipt/`
