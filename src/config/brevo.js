import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BrevoClient } = require('@getbrevo/brevo');

// Initialize the Brevo client with the API key
const apiInstance = new BrevoClient({ 
  apiKey: process.env.BREVO_API_KEY 
});

// FIXED: Add warning if API key is missing
if (!process.env.BREVO_API_KEY) {
  console.warn('⚠️ BREVO_API_KEY is not set — emails will fail to send');
}

export default apiInstance;
