import { getCustomerAppUrl, getEmailFrom, getEmailTransport } from '../config/email.js'

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export const buildPasswordResetUrl = (token: string) =>
  `${getCustomerAppUrl()}/reset-password#token=${encodeURIComponent(token)}`

export const sendPasswordResetEmail = async (input: {
  email: string
  name: string
  token: string
  expiresInMinutes: number
}) => {
  const resetUrl = buildPasswordResetUrl(input.token)
  const safeName = escapeHtml(input.name)
  const safeUrl = escapeHtml(resetUrl)

  await getEmailTransport().sendMail({
    from: getEmailFrom(),
    to: input.email,
    subject: 'Reset your Sour Lemon password',
    text: [
      `Hi ${input.name},`,
      '',
      'We received a request to reset your Sour Lemon password.',
      `Use this link within ${input.expiresInMinutes} minutes:`,
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#3d2b1f;line-height:1.6;max-width:560px;margin:auto">
        <h1 style="color:#dc5a35">Reset your password</h1>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your Sour Lemon password.</p>
        <p><a href="${safeUrl}" style="display:inline-block;background:#536238;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Choose a new password</a></p>
        <p>This link expires in ${input.expiresInMinutes} minutes and can only be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}
