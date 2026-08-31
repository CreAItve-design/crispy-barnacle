const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    const method = event.httpMethod;

    try {
        if (method === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await supabase.from('estimates').delete().eq('id', id);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'PUT') {
            const payload = JSON.parse(event.body);
            const { id, client_name, client_email, client_phone, po_job_name, project_type, itemized_lines, total_amount } = payload;
            await supabase.from('estimates').update({
                client_name, client_email, client_phone, po_job_name, project_type, itemized_lines, total_amount
            }).eq('id', id);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        if (method === 'POST') {
            const payload = JSON.parse(event.body);
            const { error: dbError } = await supabase.from('estimates').insert([{
                client_name: payload.client_name, client_email: payload.client_email, client_phone: payload.client_phone,
                po_job_name: payload.po_job_name, project_type: payload.project_type, itemized_lines: payload.itemized_lines,
                total_amount: payload.total_amount, status: 'Draft'
            }]);
            if (dbError) throw new Error(dbError.message);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};