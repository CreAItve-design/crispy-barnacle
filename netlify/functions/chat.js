const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
    // CORS headers prevent the browser from blocking requests during testing
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body);
        const userMessages = body.messages; 
        
        // Failsafe to ensure messages exist and are formatted as a valid array
        if (!userMessages || !Array.isArray(userMessages) || userMessages.length === 0) {
            return { statusCode: 400, headers, body: JSON.stringify({ reply: "No message history provided." }) };
        }

        const latestUserMessage = userMessages[userMessages.length - 1].content;
        const systemPrompt = `You are a strict, concise lead vetting agent for Spotlight Tile LLC. 
Qualify the inquiry by asking about project type (shower/floor/backsplash), material, and timeline. 
Keep it to two sentences.`;

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...userMessages
        ];

        // Fetches the AI response from Groq using the active gpt-oss-20b model
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b', 
                messages: apiMessages,
                temperature: 0.5, 
                max_completion_tokens: 150 // Updated to reflect Groq's new API parameters
            })
        });

        if (!response.ok) {
            throw new Error(`API failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const aiReply = data.choices[0].message.content;

        // Email Notification Logic
        try {
            const emailOrPhoneRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b)/;
            
            if (emailOrPhoneRegex.test(latestUserMessage) && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                });

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: `${process.env.EMAIL_USER}, ${process.env.MY_PHONE_EMAIL}`,
                    subject: '🚨 New Tile Lead via Spotlight Website',
                    text: `You have a new client inquiry!\n\nLatest message containing contact details: ${latestUserMessage}\n\nLog into your dashboard to review full chat history.`
                });
            }
        } catch (emailError) {
            console.error("Email Notification Failed:", emailError);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: aiReply })
        };

    } catch (error) {
        console.error("Backend Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ reply: "Sorry, our AI estimator is currently offline. Please call us directly!" })
        };
    }
};