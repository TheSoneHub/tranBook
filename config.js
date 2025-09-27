// Store your API Key here.
// This file SHOULD NOT be committed to version control (e.g., GitHub).
// Use environment variables or secure configuration management in production.

// SECURITY WARNING: This API key should be stored securely and never exposed in client-side code
// Consider using server-side proxy or environment variables for production deployment
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || 'YOUR_API_KEY_HERE';

// Validate API key format
if (GOOGLE_AI_API_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️ SECURITY WARNING: Default API key detected. Please set your actual API key.');
}