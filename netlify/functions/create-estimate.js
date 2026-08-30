const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    const method = event.httpMethod;

    try {
        // DELETE
        if (method === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await supabase.from('estimates').delete().eq('id', id);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // PUT (Edit/Overwrite existing)
        if (method === 'PUT') {
            const payload = JSON.parse(event.body);
            const { id, client_name, client_email, client_phone, po_job_name, project_type, itemized_lines, total_amount } = payload;
            await supabase.from('estimates').update({
                client_name, client_email, client_phone, po_job_name, project_type, itemized_lines, total_amount
            }).eq('id', id);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // POST (Create New & Email Client with Acceptance Button)
        if (method === 'POST') {
            const payload = JSON.parse(event.body);
            
            // Insert and immediately fetch the new ID
            const { data, error } = await supabase.from('estimates').insert([{
                client_name: payload.client_name, client_email: payload.client_email, client_phone: payload.client_phone,
                po_job_name: payload.po_job_name, project_type: payload.project_type, itemized_lines: payload.itemized_lines,
                total_amount: payload.total_amount, status: 'Sent'
            }]).select();
            if (error) throw new Error(error.message);

            const newEstimate = data[0];

            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});
                let itemsHtml = payload.itemized_lines.map(item => `<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item_name}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.qty}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">$${item.line_total.toFixed(2)}</td></tr>`).join('');
                
                const sendTo = payload.client_email ? `${payload.client_email}, ${process.env.EMAIL_USER}` : process.env.EMAIL_USER;
                
                // The magic Acceptance Link!
                const acceptLink = `https://spotlight-tile.com/.netlify/functions/accept-estimate?id=${newEstimate.id}`;

                await transporter.sendMail({
                    from: `"Spotlight Tile LLC" <${process.env.EMAIL_USER}>`, to: sendTo,
                    subject: `Spotlight Tile Estimate - ${payload.client_name}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 20px;">
                            <h2 style="color: #111;">Spotlight Tile LLC - Official Estimate</h2>
                            <p><strong>Client:</strong> ${payload.client_name}<br><strong>Project:</strong> ${payload.po_job_name || payload.project_type || 'Tile Installation'}</p>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
                                <thead><tr style="background: #f4f6f9;"><th style="padding: 10px;">Item</th><th style="padding: 10px;">Qty</th><th style="padding: 10px;">Line Total</th></tr></thead>
                                <tbody>${itemsHtml}</tbody>
                            </table>
                            <h3 style="text-align: right; margin-top: 20px;">Total: $${payload.total_amount.toFixed(2)}</h3>
                            
                            <!-- ACCEPT BID BUTTON -->
                            <div style="text-align: center; margin-top: 40px;">
                                <a href="${acceptLink}" style="background-color: #2e7d32; color: #ffffff; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block;">Accept Estimate</a>
                            </div>
                            <p style="color: #666; font-size: 0.9em; margin-top: 30px; text-align: center;">Clicking the button above will accept this estimate and notify Richard.</p>
                        </div>`
                });
            }
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};