const DEFAULT_COUNTRY_CODE = '233'

export function normalizePhoneNumber(value: string, countryCode = DEFAULT_COUNTRY_CODE) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  const normalizedCountryCode = countryCode.replace(/\D/g, '')
  const hadInternationalPrefix = trimmedValue.startsWith('+') || trimmedValue.startsWith('00')
  let digits = trimmedValue.replace(/\D/g, '')

  if (trimmedValue.startsWith('00')) digits = digits.slice(2)

  if (hadInternationalPrefix) {
    if (digits.startsWith(normalizedCountryCode)) {
      const nationalNumber = digits.slice(normalizedCountryCode.length).replace(/^0/, '')
      return `+${normalizedCountryCode}${nationalNumber}`
    }

    return `+${digits}`
  }

  if (digits.startsWith(normalizedCountryCode)) {
    const nationalNumber = digits.slice(normalizedCountryCode.length).replace(/^0/, '')
    return `+${normalizedCountryCode}${nationalNumber}`
  }

  return `+${normalizedCountryCode}${digits.replace(/^0+/, '')}`
}
