const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    const estimateId = event.queryStringParameters.id;
    if (!estimateId) return { statusCode: 400, body: 'Missing ID' };

    try {
        // 1. Fetch the estimate
        const { data: estData, error: estError } = await supabase.from('estimates').select('*').eq('id', estimateId).single();
        if (estError || !estData) throw new Error('Estimate not found');
        
        if (estData.status === 'Accepted') {
            return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: `<div style="text-align:center; padding: 50px; font-family:sans-serif;"><h2>Estimate already accepted!</h2><p>Richard has already been notified.</p></div>` };
        }

        // 2. Mark Estimate as Accepted
        await supabase.from('estimates').update({ status: 'Accepted' }).eq('id', estimateId);

        // 3. Automatically create an editable Invoice from the Estimate
        await supabase.from('invoices').insert([{
            client_name: estData.client_name,
            client_email: estData.client_email,
            client_phone: estData.client_phone,
            po_job_name: estData.po_job_name || estData.project_type,
            itemized_lines: estData.itemized_lines,
            total_amount: estData.total_amount,
            deposit_paid: 0,
            status: 'Unpaid'
        }]);

        // 4. Email Richard the good news
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});
            await transporter.sendMail({
                from: `"Spotlight System" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                subject: `🎉 Bid Accepted: ${estData.client_name}`,
                html: `<h3>Great news!</h3><p>${estData.client_name} just accepted Estimate #${estimateId} for $${estData.total_amount.toFixed(2)}.</p><p>An unpaid invoice has been automatically generated in your admin portal.</p>`
            });
        }

        // 5. Show Success Page to Client
        return { 
            statusCode: 200, 
            headers: { 'Content-Type': 'text/html' },
            body: `<div style="font-family: sans-serif; text-align: center; padding: 50px;"><h1 style="color: #2e7d32;">Estimate Accepted!</h1><p>Thank you, ${estData.client_name}. Richard has been notified and will be in touch shortly to get started.</p></div>` 
        };
    } catch (error) {
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
};