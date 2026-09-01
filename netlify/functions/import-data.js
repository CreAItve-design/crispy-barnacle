const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { table, records } = JSON.parse(event.body);
        
        // Bulk insert the historical records into the database
        const { error } = await supabase.from(table).insert(records);
        if (error) throw error;
        
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};