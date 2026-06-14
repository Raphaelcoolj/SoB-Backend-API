import dotenv from 'dotenv'
import { sendEmail } from '../utils/sendEmail.js'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const test = async () => {
  console.log('Sending test email...');
  try {
    await sendEmail({
      to: 'your_test_email@gmail.com', // User to update this
      subject: 'SoB Test Email',
      html: '<p>This is a test email from SoB backend.</p>'
    })
    console.log('✅ Test email sent successfully')
  } catch (error) {
    console.error('❌ Test email failed:', error.message)
  }
  process.exit(0)
}

test()
