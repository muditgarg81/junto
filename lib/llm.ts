'use strict';

// Server-side LLM service module for Junto
// Communicates with Google Gemini via REST API

interface GenerateParts {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
}

interface GenerateContentRequest {
  contents: {
    role?: string;
    parts: GenerateParts[];
  }[];
  systemInstruction?: {
    parts: { text: string }[];
  };
  generationConfig?: {
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
  };
}

function getApiKeyAndModel() {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';
  const visionModel = process.env.LLM_VISION_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.warn('Warning: LLM_API_KEY environment variable is missing.');
  }

  return { apiKey, model, visionModel };
}

/**
 * Text completion helper
 */
export async function complete(
  prompt: string,
  systemPrompt?: string,
  jsonSchema?: any
): Promise<string> {
  const { apiKey, model } = getApiKeyAndModel();
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not defined in environment variables.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: GenerateContentRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for high precision structured output
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (jsonSchema) {
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: 'application/json',
      responseSchema: jsonSchema,
    };
  } else {
    // If no explicit schema, still prompt JSON mode if requested
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: 'application/json',
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned an empty response.');
  }

  return text.trim();
}

/**
 * Text completion helper returning token usage count
 */
export async function completeWithUsage(
  prompt: string,
  systemPrompt?: string,
  jsonSchema?: any
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { apiKey, model } = getApiKeyAndModel();
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not defined in environment variables.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: GenerateContentRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (jsonSchema) {
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: 'application/json',
      responseSchema: jsonSchema,
    };
  } else {
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: 'application/json',
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned an empty response.');
  }

  const usage = data.usageMetadata || {};

  return {
    text: text.trim(),
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0
  };
}

/**
 * Image/PDF vision completion helper
 */
export async function completeVision(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const { apiKey, visionModel } = getApiKeyAndModel();
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not defined in environment variables.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`;

  const base64Data = imageBuffer.toString('base64');

  const requestBody: GenerateContentRequest = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (vision): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini Vision API returned an empty response.');
  }

  return text.trim();
}
