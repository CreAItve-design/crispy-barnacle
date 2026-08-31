const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.handler = async (event) => {
    const method = event.httpMethod;
    if (method === 'GET') { const { data } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false }); return { statusCode: 200, body: JSON.stringify(data || []) }; }
    if (method === 'DELETE') { await supabase.from('invoices').delete().eq('id', JSON.parse(event.body).id); return { statusCode: 200, body: JSON.stringify({ success: true }) }; }
    if (method === 'POST') {
        const payload = JSON.parse(event.body); payload.status = 'Unpaid';
        const { error } = await supabase.from('invoices').insert([payload]);
        if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (method === 'PUT') {
        const payload = JSON.parse(event.body);
        if (payload.itemized_lines) { await supabase.from('invoices').update(payload).eq('id', payload.id); } 
        else { await supabase.from('invoices').update({ status: payload.status }).eq('id', payload.id); }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 405 };
};