import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Brevo } = require('@getbrevo/brevo');

// The `Brevo` object itself acts as the client and container for APIs
const apiInstance = Brevo;

// Set API key on the object or configure as needed for your specific SDK version
// Based on inspection, we likely need to configure it differently or it uses process.env implicitly
// For now, assume it's pre-configured via process.env or requires a different setter
if (apiInstance.setApiKey) {
    apiInstance.setApiKey(process.env.BREVO_API_KEY);
}

// FIXED: Add warning if API key is missing
if (!process.env.BREVO_API_KEY) {
  console.warn('⚠️ BREVO_API_KEY is not set — emails will fail to send');
}

export default apiInstance;
