const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.handler = async (event) => {
    const method = event.httpMethod;
    try {
        if (method === 'DELETE') {
            await supabase.from('estimates').delete().eq('id', JSON.parse(event.body).id); return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'PUT') {
            const payload = JSON.parse(event.body);
            await supabase.from('estimates').update(payload).eq('id', payload.id); return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'POST') {
            const payload = JSON.parse(event.body); payload.status = 'Draft';
            const { error } = await supabase.from('estimates').insert([payload]);
            if (error) throw error; return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 405 };
    } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};