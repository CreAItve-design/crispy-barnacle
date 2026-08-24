const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
    // Only allow incoming POST requests from your website frontend
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body);
        const userMessages = body.messages; // Receives the full continuous history array
        
        // Safety check to ensure messages array exists and isn't empty
        if (!userMessages || userMessages.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ reply: "No message history provided." }) };
        }

        const latestUserMessage = userMessages[userMessages.length - 1].content;

        // Custom guidelines dictating how the Llama 3 model behaves
        const systemPrompt = `You are a strict, concise lead vetting assistant for Spotlight Tile LLC. 
	Your goal is to qualify the inquiry by asking about project type (shower, floor, backsplash), material, and timeline.
	Keep responses to 1-2 sentences. 
	CRITICAL RULES:
	1. Never invent or imagine employee names.
	2. The Master Installer is Richard. The Interior Designer is Crystal. There are no other named employees.
	3. If a user asks to speak with someone, schedule a quote, or get contact info, explicitly tell them: "You can text our 	Master Installer, Richard, anytime at 720-402-8263. He prefers text messages over phone calls or voicemails."`;

        // Prepend the system prompt guidelines to the front of the chat history
        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...userMessages
        ];

        // Route the full chat history directly to the cloud-hosted Groq endpoint
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // The active, lightning-fast replacement
                messages: apiMessages,
                temperature: 0.5, 
                max_tokens: 150 
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        const aiReply = data.choices[0].message.content;

        // --- EMAIL & TEXT NOTIFICATION LOGIC ---
        // Checks only the latest inbound message for an email structure or 10-digit phone string
        const emailOrPhoneRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b)/;
        if (emailOrPhoneRegex.test(latestUserMessage)) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { 
                    user: process.env.EMAIL_USER, 
                    pass: process.env.EMAIL_PASS 
                }
            });

            // Fires a single payload routing simultaneously to your inbox and phone gateway
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: `${process.env.EMAIL_USER}, ${process.env.MY_PHONE_EMAIL}`,
                subject: '🚨 New Tile Lead via Groq Llama 3!',
                text: `You have a new client inquiry!\n\nLatest message containing contact details: ${latestUserMessage}\n\nLog into your dashboard to review full chat history.`
            });
        }
        // ---------------------------------------

        // Send the generated text back to your website frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ reply: aiReply })
        };

    } catch (error) {
        console.error("Backend Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ reply: "Sorry, our AI estimator is currently offline. Please call us directly!" })
        };
    }
};


