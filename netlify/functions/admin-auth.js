exports.handler = async function(event, context) {
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
        const { password } = JSON.parse(event.body);
        
        if (password === process.env.ADMIN_SECRET_KEY) {
            return { statusCode: 200, headers, body: JSON.stringify({ token: "authenticated_ok" }) };
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid password" }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error" }) };
    }
};