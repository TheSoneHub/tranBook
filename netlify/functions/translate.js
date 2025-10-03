<<<<<<< HEAD
// File: netlify/functions/translate.js
exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
=======
// Using 'await import' for node-fetch as it's an ES module.
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event) {
    // 1. Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
>>>>>>> 4da0c2129ebf320e63e6b55c0d9a539a214fe08d
    }

    try {
        const { textToTranslate, targetLanguage } = JSON.parse(event.body);
<<<<<<< HEAD
        const apiKey = process.env.GOOGLE_AI_API_KEY; // Get the key from Netlify's secure environment

        if (!apiKey) {
            throw new Error("API Key is not configured.");
        }

        const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
=======
        
        // 2. Validate input from the browser
        if (!textToTranslate || !targetLanguage) {
             return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing 'textToTranslate' or 'targetLanguage' in request." })
            };
        }

        // 3. Securely get the API key from environment variables
        const apiKey = process.env.GOOGLE_AI_API_KEY; 

        if (!apiKey) {
            console.error("API Key is not configured in Netlify environment.");
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Server configuration error: API Key is missing." })
            };
        }
        
        // 4. Construct the prompt for the AI
        const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        // 5. Call the Google AI API
        const response = await fetch(apiEndpoint, {
>>>>>>> 4da0c2129ebf320e63e6b55c0d9a539a214fe08d
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

<<<<<<< HEAD
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Google AI API Error:", errorData);
            return { statusCode: response.status, body: JSON.stringify(errorData) };
        }

        const data = await response.json();
        const translation = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : "No translation found.";
=======
        const data = await response.json();

        // 6. Handle errors from the Google AI API
        if (!response.ok) {
            console.error("Google AI API Error:", data);
            const errorMessage = data?.error?.message || "An error occurred with the translation service.";
            return { statusCode: response.status, body: JSON.stringify({ error: errorMessage }) };
        }

        // 7. Extract the translation and send it back to the browser
        const translation = data.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "No translation found.";
>>>>>>> 4da0c2129ebf320e63e6b55c0d9a539a214fe08d

        return {
            statusCode: 200,
            body: JSON.stringify({ translation: translation })
        };

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return {
            statusCode: 500,
<<<<<<< HEAD
            body: JSON.stringify({ error: error.message })
=======
            body: JSON.stringify({ error: "An internal server error occurred." })
>>>>>>> 4da0c2129ebf320e63e6b55c0d9a539a214fe08d
        };
    }
};