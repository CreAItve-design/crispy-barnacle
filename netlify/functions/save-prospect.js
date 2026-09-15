const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const payload = JSON.parse(event.body);
        
        const { error } = await supabase.from('prospects').insert([{
            client_name: payload.client_name,
            phone: payload.phone,
            project_type: payload.project_type,
            estimated_min: payload.estimated_min,
            estimated_max: payload.estimated_max,
            notes: payload.notes,
            photo_data: payload.photo_data
        }]);

        if (error) throw error;
        
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};