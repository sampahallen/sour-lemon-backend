import nodemailer from 'nodemailer'

const requiredSetting = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} must be configured to send password reset emails`)
  return value
}

const getSmtpPort = () => {
  const port = Number(process.env.SMTP_PORT ?? 587)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number')
  }
  return port
}

const getSmtpSecure = () => {
  const value = (process.env.SMTP_SECURE ?? 'false').trim().toLowerCase()
  if (value !== 'true' && value !== 'false') {
    throw new Error('SMTP_SECURE must be true or false')
  }
  return value === 'true'
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

export const getEmailTransport = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: requiredSetting('SMTP_HOST'),
      port: getSmtpPort(),
      secure: getSmtpSecure(),
      auth: {
        user: requiredSetting('SMTP_USER'),
        pass: requiredSetting('SMTP_PASSWORD'),
      },
    })
  }
  return transporter
}

export const getEmailFrom = () => requiredSetting('SMTP_FROM')

export const getCustomerAppUrl = () => {
  const value = requiredSetting('CUSTOMER_APP_URL').replace(/\/$/, '')
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('CUSTOMER_APP_URL must use HTTP or HTTPS')
  }
  return url.toString().replace(/\/$/, '')
}

export const getPasswordResetTokenTtlMinutes = () => {
  const minutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 30)
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    throw new Error('PASSWORD_RESET_TOKEN_TTL_MINUTES must be between 5 and 120')
  }
  return minutes
}
