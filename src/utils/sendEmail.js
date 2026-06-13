import brevo from '../config/brevo.js'

export const sendEmail = async ({ to, subject, html }) => {
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: subject,
      htmlContent: html,
      sender: { name: 'SoB', email: 'noreply@sobplatform.com' },
      to: [{ email: to }]
    })
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
