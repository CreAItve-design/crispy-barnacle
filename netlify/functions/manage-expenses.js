const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const payload = JSON.parse(event.body);
        
        // Construct the expense object
        const insertData = {
            category: payload.category,
            vendor_name: payload.vendor_name,
            amount: parseFloat(payload.amount),
            description: payload.description
        };

        // If a manual date was provided, convert it to a database-friendly timestamp
        if (payload.created_at) {
            insertData.created_at = new Date(payload.created_at).toISOString();
        }

        const { error } = await supabase.from('expenses').insert([insertData]);

        if (error) throw error;
        
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};