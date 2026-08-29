exports.handler = async () => {
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
    const headers = {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    };
    
    try {
        const res = await fetch(`${baseUrl}/rest/v1/price_sheet?select=*&order=item_name.asc`, { headers });
        const data = await res.json();
        
        // If Supabase returns an error message instead of an array of items, throw it to the screen
        if (!Array.isArray(data)) {
            return { statusCode: 500, body: JSON.stringify({ error: `Supabase Error: ${JSON.stringify(data)}` }) };
        }
        
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};