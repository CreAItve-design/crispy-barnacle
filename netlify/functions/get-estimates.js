exports.handler = async () => {
    if (!process.env.SUPABASE_URL) return { statusCode: 500, body: JSON.stringify({ error: 'Missing URL Env Var' }) };
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
    
    try {
        const res = await fetch(`${baseUrl}/rest/v1/estimates?select=*&order=created_at.desc`, {
            headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        return { statusCode: 200, body: JSON.stringify(await res.json()) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};