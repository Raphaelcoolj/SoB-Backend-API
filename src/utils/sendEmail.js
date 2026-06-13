import * as SibApiV3Sdk from '@getbrevo/brevo'
import apiInstance from '../config/brevo.js'

export const sendEmail = async ({ to, subject, html }) => {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = html
  sendSmtpEmail.sender = { name: 'SoB', email: 'noreply@sobplatform.com' }
  sendSmtpEmail.to = [{ email: to }]

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail)
  } catch (error) {
    throw new Error(`Brevo email error: ${error.message}`)
  }
}

export const sendBatchEmail = async (recipients, subject, html) => {
  for (const to of recipients) {
    await sendEmail({ to, subject, html })
  }
  console.log('Batch email sending complete.')
}
