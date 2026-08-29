const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    const method = event.httpMethod;

    if (method === 'GET') {
        const { data } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
        return { statusCode: 200, body: JSON.stringify(data || []) };
    }
    
    if (method === 'POST') {
        const payload = JSON.parse(event.body);
        await supabase.from('clients').upsert([{ name: payload.client_name, email: payload.client_email }], { onConflict: 'name' });
        
        await supabase.from('invoices').insert([{
            client_name: payload.client_name,
            client_email: payload.client_email,
            itemized_lines: payload.itemized_lines,
            total_amount: payload.total_amount,
            deposit_paid: payload.deposit_paid || 0,
            status: 'Unpaid'
        }]);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (method === 'PUT') {
        const { id, status } = JSON.parse(event.body);
        await supabase.from('invoices').update({ status }).eq('id', id);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
};