import apiInstance from '../config/brevo.js'

// FIXED: Updated to use the correct brevo client transactionalEmails API
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const result = await apiInstance.transactionalEmails.sendTransacEmail({
      subject: subject,
      htmlContent: html,
      sender: { name: 'SoB', email: process.env.BREVO_SENDER_EMAIL || 'noreply@sobplatform.com' },
      to: [{ email: to }]
    })
    
    console.log(`✅ Email sent to ${to}:`, result?.messageId || 'success')
    return result
  } catch (error) {
    console.error(`❌ Brevo email error sending to ${to}:`, error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export const sendBatchEmail = async (recipients, subject, html) => {
  for (const to of recipients) {
    await sendEmail({ to, subject, html })
  }
  console.log('Batch email sending complete.')
}
