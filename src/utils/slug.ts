export const toSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const toDraftSlug = (title: string, id: string, maxLength = 220) => {
  const suffix = `-${id.toLowerCase()}`
  const base = toSlug(title)
  const availableBaseLength = maxLength - suffix.length

  if (!base || availableBaseLength < 1) return ''

  return `${base.slice(0, availableBaseLength).replace(/-+$/g, '')}${suffix}`
}
