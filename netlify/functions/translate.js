// File: netlify/functions/translate.js
exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { textToTranslate, targetLanguage } = JSON.parse(event.body);
        const apiKey = process.env.GOOGLE_AI_API_KEY; // Get the key from Netlify's secure environment

        if (!apiKey) {
            throw new Error("API Key is not configured.");
        }

        const prompt = `Translate the following text into natural and fluent ${targetLanguage}. Maintain the original context and tone. Provide only the translated text without any additional explanations or labels. Text to translate: "${textToTranslate}"\n\n${targetLanguage} Translation:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Google AI API Error:", errorData);
            return { statusCode: response.status, body: JSON.stringify(errorData) };
        }

        const data = await response.json();
        const translation = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : "No translation found.";

        return {
            statusCode: 200,
            body: JSON.stringify({ translation: translation })
        };

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};