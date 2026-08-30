exports.handler = async (event) => {
    if (event.httpMethod !== 'PUT') return { statusCode: 405, body: 'Method Not Allowed' };
    
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
    const headers = {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    };

    try {
        const { id, new_price } = JSON.parse(event.body);
        
        // Supabase REST API requires PATCH to update existing rows
        const res = await fetch(`${baseUrl}/rest/v1/price_sheet?id=eq.${id}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ unit_price: parseFloat(new_price) })
        });

        if (!res.ok) throw new Error(await res.text());
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};