import SibApiV3Sdk from '@getbrevo/brevo'

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

// FIXED: Add warning if API key is missing
if (!process.env.BREVO_API_KEY) {
  console.warn('⚠️ BREVO_API_KEY is not set — emails will fail to send')
}

export default apiInstance
