export const toNumber = (value) => Number(value || 0)

export const toCurrency = (value) => `PKR ${toNumber(value).toFixed(2)}`

export const paymentStatusClasses = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-red-100 text-red-700',
}

export const normalizeWhatsAppPhone = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('0')) {
    digits = `92${digits.slice(1)}`
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = `92${digits}`
  }

  return digits
}

export const createWhatsAppUrl = (phone, message) => {
  const normalizedPhone = normalizeWhatsAppPhone(phone)
  if (!normalizedPhone) {
    return null
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export const fetchAllResults = async (fetcher, params = {}) => {
  let page = 1
  let count = 0
  const results = []

  while (true) {
    const response = await fetcher({ ...params, page, page_size: 100 })
    const payload = response.data
    const pageResults = Array.isArray(payload) ? payload : payload?.results || []

    results.push(...pageResults)
    count = Array.isArray(payload) ? results.length : payload?.count || results.length

    if (Array.isArray(payload) || !payload?.next || pageResults.length === 0) {
      break
    }

    page += 1
  }

  return { count, results }
}
