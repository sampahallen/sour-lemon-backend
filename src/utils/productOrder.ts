export const isExactProductOrder = (requested: readonly string[], current: readonly string[]) => {
  if (requested.length !== current.length) return false
  const currentIds = new Set(current)
  return currentIds.size === current.length &&
    new Set(requested).size === requested.length &&
    requested.every((id) => currentIds.has(id))
}
