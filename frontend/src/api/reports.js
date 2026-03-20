// G:/msms/frontend/src/api/reports.js
import api from './axios'
import { API_BASE_URL } from './baseUrl'

export const getDashboardStats = () => api.get('/reports/dashboard/')
export const getDailySales = (date) => api.get('/reports/daily-sales/', { params: { date } })
export const getMonthlySales = (year, month) => api.get('/reports/monthly-sales/', { params: { year, month } })
export const getStockReport = () => api.get('/reports/stock/')
export const getExpiryReport = (days = 30) => api.get('/reports/expiry/', { params: { days } })
export const exportDailySalesCsv = (date) => {
  return `${API_BASE_URL}/reports/daily-sales/export/?date=${date}`
}
export const exportStockCsv = () => {
  return `${API_BASE_URL}/reports/stock/export/`
}
