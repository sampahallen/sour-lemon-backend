import { spawnSync } from 'node:child_process'

const port = Number(process.argv[2])

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error('Usage: node scripts/free-port.mjs <port>')
  process.exit(1)
}

const command = (file, args) => spawnSync(file, args, { encoding: 'utf8' })

const windowsListenerPids = () => {
  const result = command('netstat', ['-ano', '-p', 'tcp'])
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr.trim() || 'netstat failed')
  }

  return new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) =>
        parts.length >= 5 &&
        parts[0] === 'TCP' &&
        parts[1].endsWith(`:${port}`) &&
        parts[3] === 'LISTENING',
      )
      .map((parts) => Number(parts[4]))
      .filter((pid) => Number.isInteger(pid) && pid > 0),
  )
}

const unixListenerPids = () => {
  const result = command('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || 'lsof failed')
  }
  return new Set(
    result.stdout
      .split(/\s+/)
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0),
  )
}

try {
  const pids = process.platform === 'win32' ? windowsListenerPids() : unixListenerPids()

  if (pids.size === 0) {
    console.log(`Port ${port} is free`)
    process.exit(0)
  }

  for (const pid of pids) {
    if (process.platform === 'win32') {
      const result = command('taskkill', ['/PID', String(pid), '/T', '/F'])
      if (result.error || result.status !== 0) {
        throw result.error ?? new Error(result.stderr.trim() || `Could not stop PID ${pid}`)
      }
    } else {
      process.kill(pid, 'SIGTERM')
    }
    console.log(`Stopped PID ${pid} on port ${port}`)
  }
} catch (error) {
  console.error(`Could not free port ${port}:`, error instanceof Error ? error.message : error)
  process.exit(1)
}
