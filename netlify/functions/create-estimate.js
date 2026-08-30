const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    try {
        const payload = JSON.parse(event.body);
        
        // 1. Save Document (WITH error catching)
        const { error: dbError } = await supabase.from('estimates').insert([{
            client_name: payload.client_name,
            client_email: payload.client_email,
            client_phone: payload.client_phone,
            po_job_name: payload.po_job_name,
            project_type: payload.project_type,
            itemized_lines: payload.itemized_lines,
            total_amount: payload.total_amount,
            status: 'Draft'
        }]);

        if (dbError) throw new Error(`Database rejected the save: ${dbError.message}`);

        // 2. Build and Send the HTML Email to the Client
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });
            
            // Build the itemized table for the email body
            let itemsHtml = payload.itemized_lines.map(item => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item_name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.qty}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">$${item.line_total.toFixed(2)}</td>
                </tr>
            `).join('');

            // Send to client (if provided), CC Richard
            const sendTo = payload.client_email ? `${payload.client_email}, ${process.env.EMAIL_USER}` : process.env.EMAIL_USER;

            await transporter.sendMail({
                from: `"Spotlight Tile LLC" <${process.env.EMAIL_USER}>`,
                to: sendTo,
                subject: `Spotlight Tile Estimate - ${payload.client_name}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 20px;">
                        <h2 style="color: #111;">Spotlight Tile LLC - Official Estimate</h2>
                        <p><strong>Client:</strong> ${payload.client_name}<br>
                        <strong>Project:</strong> ${payload.po_job_name || payload.project_type || 'Tile Installation'}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
                            <thead><tr style="background: #f4f6f9;"><th style="padding: 10px;">Item</th><th style="padding: 10px;">Qty</th><th style="padding: 10px;">Line Total</th></tr></thead>
                            <tbody>${itemsHtml}</tbody>
                        </table>
                        
                        <h3 style="text-align: right; margin-top: 20px;">Total: $${payload.total_amount.toFixed(2)}</h3>
                        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">Thank you for your business! Please reply directly to this email if you have any questions or are ready to proceed.</p>
                    </div>
                `
            });
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};