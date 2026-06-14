import dotenv from 'dotenv'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const test = async () => {
  // Replace with a real refresh token from your DB/localStorage
  const refreshToken = 'PASTE_A_REAL_REFRESH_TOKEN_HERE'

  console.log('Testing refresh endpoint...');
  const response = await fetch(`http://localhost:5000/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  const data = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
  process.exit(0)
}

test()
