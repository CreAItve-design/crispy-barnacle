const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    try {
        const { id } = JSON.parse(event.body);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: est, error } = await supabase.from('estimates').select('*').eq('id', id).single();
        if (error || !est) throw new Error('Estimate not found');

        // Draw PDF
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // Fetch & Add Logo to PDF
        let logoBuffer;
        try {
            const res = await fetch('https://spotlight-tile.com/logo.png');
            if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
        } catch(e) {}

        if (logoBuffer) {
            doc.image(logoBuffer, (doc.page.width - 160) / 2, 50, { width: 160 });
            doc.y = 130; // Push text down below the logo
        } else {
            doc.fontSize(22).text('Spotlight Tile LLC', { align: 'center' }).moveDown();
        }

        doc.fontSize(16).text(`ESTIMATE #${est.id}`);
        doc.fontSize(10).text(`Date: ${new Date(est.created_at || new Date()).toLocaleDateString()}`).moveDown();
        
        doc.text(`Prepared For: ${est.client_name}`);
        if (est.client_email) doc.text(`Email: ${est.client_email}`);
        if (est.client_phone) doc.text(`Phone: ${est.client_phone}`);
        if (est.project_type) doc.text(`Project: ${est.project_type}`);
        if (est.po_job_name) doc.text(`PO/Job Name: ${est.po_job_name}`);
        doc.moveDown(2);

        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item Description', 50, tableTop);
        doc.text('Qty', 350, tableTop, { width: 50, align: 'center' });
        doc.text('Line Total', 420, tableTop, { width: 80, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
        
        doc.font('Helvetica');
        let y = tableTop + 25;
        est.itemized_lines.forEach(item => {
            doc.text(item.item_name, 50, y, { width: 280 });
            doc.text(item.qty.toString(), 350, y, { width: 50, align: 'center' });
            doc.text(`$${item.line_total.toFixed(2)}`, 420, y, { width: 80, align: 'right' });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(500, y + 10).stroke();
        y += 20;
        doc.font('Helvetica-Bold').fontSize(14);
        doc.text(`Estimate Total: $${est.total_amount.toFixed(2)}`, 250, y, { width: 250, align: 'right' });
        doc.end();

        const pdfBuffer = await new Promise(resolve => { doc.on('end', () => resolve(Buffer.concat(buffers))); });

        // Update Database to "Sent"
        await supabase.from('estimates').update({ status: 'Sent' }).eq('id', id);

        // Send Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});
            const sendTo = est.client_email ? est.client_email : process.env.EMAIL_USER;
            const acceptLink = `https://spotlight-tile.com/.netlify/functions/accept-estimate?id=${est.id}`;
            let itemsHtml = est.itemized_lines.map(item => `<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item_name}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.qty}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">$${item.line_total.toFixed(2)}</td></tr>`).join('');

            await transporter.sendMail({
                from: `"Spotlight Tile LLC" <${process.env.EMAIL_USER}>`,
                to: sendTo, cc: process.env.EMAIL_USER,
                subject: `Spotlight Tile Estimate #${est.id} - ${est.client_name}`,
                html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 20px;">
                    <div style="text-align: center;"><img src="https://spotlight-tile.com/logo.png" alt="Spotlight Tile LLC" width="160"></div>
                    <h2 style="color: #111; text-align: center;">Official Estimate</h2>
                    <p><strong>Client:</strong> ${est.client_name}<br><strong>Project:</strong> ${est.po_job_name || est.project_type || 'Tile Installation'}</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
                        <thead><tr style="background: #f4f6f9;"><th style="padding: 10px;">Item</th><th style="padding: 10px;">Qty</th><th style="padding: 10px;">Line Total</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <h3 style="text-align: right; margin-top: 20px;">Total: $${est.total_amount.toFixed(2)}</h3>
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${acceptLink}" style="background-color: #2e7d32; color: #ffffff; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Accept Estimate</a>
                    </div>
                    <p style="color: #666; font-size: 0.9em; margin-top: 30px; text-align: center;">Clicking the button above will accept this estimate and notify Richard. A PDF copy is attached for your records.</p>
                </div>`,
                attachments: [{ filename: `Spotlight_Tile_Estimate_${est.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
            });
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};