const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const { estimateId } = JSON.parse(event.body);
        if (!estimateId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Estimate ID is required' }) };
        }

        // 1. Fetch the existing estimate from the database
        const { data: estimate, error: fetchError } = await supabase
            .from('estimates')
            .select('*')
            .eq('id', estimateId)
            .single();

        if (fetchError || !estimate) {
            throw new Error('Estimate not found');
        }

        // 2. Insert a new invoice record using the estimate data
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert([{
                estimate_id: estimate.id,
                client_name: estimate.client_name,
                client_email: estimate.client_email,
                client_phone: estimate.client_phone,
                itemized_lines: estimate.itemized_lines,
                total_amount: estimate.total_amount,
                status: 'Unpaid',
                issue_date: new Date().toISOString()
            }])
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // 3. Mark the original estimate as Accepted
        await supabase
            .from('estimates')
            .update({ status: 'Accepted' })
            .eq('id', estimateId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Estimate successfully converted to invoice!', invoice })
        };

    } catch (error) {
        console.error('Conversion Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};