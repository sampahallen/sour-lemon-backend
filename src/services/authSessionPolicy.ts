export interface SessionTimes {
  createdAt: Date
  expiresAt: Date
  lastActivityAt: Date
}

export const sessionDeadlines = (session: SessionTimes, absoluteMs: number, idleMs: number) => ({
  absolute: new Date(Math.min(session.expiresAt.getTime(), session.createdAt.getTime() + absoluteMs)),
  idle: new Date(session.lastActivityAt.getTime() + idleMs),
})

export const isSessionActive = (session: SessionTimes, absoluteMs: number, idleMs: number, now: Date) => {
  const deadlines = sessionDeadlines(session, absoluteMs, idleMs)
  return deadlines.absolute > now && deadlines.idle > now
}

export const isConcurrentRefreshUse = (usedAt: Date, now: Date) =>
  now.getTime() - usedAt.getTime() < 15_000
