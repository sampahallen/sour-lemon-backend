export const toSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const toNumberedSlug = (value: string, sequence = 0, maxLength = 120) => {
  const suffix = sequence > 0 ? `-${sequence}` : ''
  const availableBaseLength = maxLength - suffix.length
  if (availableBaseLength < 1) return ''

  const base = toSlug(value).slice(0, availableBaseLength).replace(/-+$/g, '')
  return base ? `${base}${suffix}` : ''
}

export const nextAvailableSlug = async (
  value: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxLength = 120,
) => {
  for (let sequence = 0; ; sequence += 1) {
    const candidate = toNumberedSlug(value, sequence, maxLength)
    if (!candidate) return ''
    if (!(await isTaken(candidate))) return candidate
  }
}

export const toDraftSlug = (title: string, id: string, maxLength = 220) => {
  const suffix = `-${id.toLowerCase()}`
  const base = toSlug(title)
  const availableBaseLength = maxLength - suffix.length

  if (!base || availableBaseLength < 1) return ''

  return `${base.slice(0, availableBaseLength).replace(/-+$/g, '')}${suffix}`
}
