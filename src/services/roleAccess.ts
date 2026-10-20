import type { UserRole } from '../models/types.js'

export const hasActiveRole = (
  roles: UserRole[],
  legacyRole: UserRole,
  sessionRole: UserRole | null,
  requestedRole: UserRole,
) => roles.includes(requestedRole) && (sessionRole ?? legacyRole) === requestedRole

export const canDeleteOwnAccount = (roles: UserRole[]) => !roles.includes('admin')

export const canRevokeAdmin = (targetIsActive: boolean, activeAdminCount: number) =>
  !targetIsActive || activeAdminCount > 1
