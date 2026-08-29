const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    try {
        const payload = JSON.parse(event.body);
        
        // Auto-save client info
        await supabase.from('clients').upsert([{ name: payload.client_name, email: payload.client_email }], { onConflict: 'name' });

        // Save estimate
        await supabase.from('estimates').insert([{
            client_name: payload.client_name,
            client_email: payload.client_email,
            project_type: payload.project_type,
            itemized_lines: payload.itemized_lines,
            total_amount: payload.total_amount,
            status: 'Draft'
        }]);

        // CC Richard
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: `${process.env.EMAIL_USER}, ${process.env.MY_PHONE_EMAIL}`,
                subject: `📄 New Estimate Created: ${payload.client_name}`,
                text: `You generated a new estimate for ${payload.client_name}.\nTotal: $${payload.total_amount}\nLog into your admin portal to review.`
            });
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};