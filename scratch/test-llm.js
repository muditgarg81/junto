'use strict';

const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn('Error reading .env.local:', e.message);
}

// We import the compiled or runtime complete module
// But since the project is in Next.js, we can write a simple direct fetch helper inside this script 
// that mirrors lib/llm.ts to verify the connection is valid and the model is correct!
async function verifyConnection() {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.error('LLM_API_KEY is not defined in environment variables. Please check your .env.local.');
    process.exit(1);
  }

  console.log(`Verifying connection to model "${model}"...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: 'Respond with exactly the word "SUCCESS" and nothing else.' }],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Gemini API response:', text ? text.trim() : 'Empty response');
}

verifyConnection().catch(err => {
  console.error('LLM Verification failed:', err);
  process.exit(1);
});
