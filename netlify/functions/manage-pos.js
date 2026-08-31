const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    const method = event.httpMethod;
    try {
        if (method === 'GET') {
            const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
            return { statusCode: 200, body: JSON.stringify(data || []) };
        }
        if (method === 'POST') {
            const { error } = await supabase.from('purchase_orders').insert([JSON.parse(event.body)]);
            if (error) throw error; return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'PUT') {
            const payload = JSON.parse(event.body);
            const { error } = await supabase.from('purchase_orders').update(payload).eq('id', payload.id);
            if (error) throw error; return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await supabase.from('purchase_orders').delete().eq('id', id);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 405 };
    } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};