const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    try {
        const payload = JSON.parse(event.body);
        const { error } = await supabase.from('estimates').insert([{
            client_name: payload.client_name,
            client_email: payload.client_email,
            project_type: payload.project_type,
            itemized_lines: payload.itemized_lines,
            total_amount: payload.total_amount,
            status: 'Draft'
        }]);
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};