import * as SibApiV3Sdk from '@getbrevo/brevo'
import apiInstance from '../config/brevo.js'

// FIXED: Updated to use the TransactionalEmailsApi and added robust error handling
export const sendEmail = async ({ to, subject, html }) => {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = html
  sendSmtpEmail.sender = { name: 'SoB', email: process.env.BREVO_SENDER_EMAIL || 'noreply@sobplatform.com' }
  sendSmtpEmail.to = [{ email: to }]

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log(`✅ Email sent to ${to}:`, result.body?.messageId || 'success')
    return result
  } catch (error) {
    console.error(`❌ Brevo email error sending to ${to}:`, error.response?.body || error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export const sendBatchEmail = async (recipients, subject, html) => {
  for (const to of recipients) {
    await sendEmail({ to, subject, html })
  }
  console.log('Batch email sending complete.')
}
