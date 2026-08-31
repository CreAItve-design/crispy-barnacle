const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { id } = JSON.parse(event.body);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: po, error } = await supabase.from('purchase_orders').select('*').eq('id', id).single();

        if (error || !po) throw new Error('PO not found');

        // Draw PDF
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // Add Logo
        let logoBuffer;
        try {
            const res = await fetch('https://spotlight-tile.com/image.png');
            if (res.ok) logoBuffer = Buffer.from(await res.arrayBuffer());
        } catch(e) {}

        if (logoBuffer) {
            doc.image(logoBuffer, (doc.page.width - 160) / 2, 50, { width: 160 });
            doc.y = 130;
        } else {
            doc.fontSize(22).text('Spotlight Tile LLC', { align: 'center' }).moveDown();
        }

        doc.fontSize(16).fillColor('#1565c0').text(`PURCHASE ORDER (PO-${po.id})`, { align: 'center' }).fillColor('#111111').moveDown();
        doc.fontSize(10).text(`Date: ${new Date(po.created_at).toLocaleDateString()}`).moveDown();
        
        doc.text(`Contractor: ${po.ic_name}`);
        if (po.ic_email) doc.text(`Email: ${po.ic_email}`);
        if (po.ic_phone) doc.text(`Phone: ${po.ic_phone}`);
        if (po.labor_type) doc.text(`Labor Type: ${po.labor_type}`);
        doc.moveDown();
        
        doc.text(`Client Reference: ${po.client_name}`);
        if (po.client_address) doc.text(`Site Address: ${po.client_address}`);
        doc.moveDown(2);

        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Scope of Work', 50, tableTop);
        doc.text('Qty', 350, tableTop, { width: 40, align: 'center' });
        doc.text('Rate', 400, tableTop, { width: 50, align: 'right' });
        doc.text('Total', 460, tableTop, { width: 60, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();
        
        doc.font('Helvetica');
        let y = tableTop + 25;
        po.itemized_lines.forEach(item => {
            doc.text(item.item_name, 50, y, { width: 280 });
            doc.text(item.qty.toString(), 350, y, { width: 40, align: 'center' });
            doc.text(`$${item.unit_price.toFixed(2)}`, 400, y, { width: 50, align: 'right' });
            doc.text(`$${item.line_total.toFixed(2)}`, 460, y, { width: 60, align: 'right' });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(520, y + 10).stroke();
        y += 20;
        doc.font('Helvetica-Bold').fontSize(14);
        doc.text(`PO Total: $${po.total_amount.toFixed(2)}`, 250, y, { width: 270, align: 'right' });
        
        if (po.comments) {
            y += 40;
            doc.fontSize(10).text('Instructions:', 50, y);
            doc.font('Helvetica').text(po.comments, 50, y + 15, { width: 470 });
        }

        doc.end();
        const pdfBuffer = await new Promise(resolve => { doc.on('end', () => resolve(Buffer.concat(buffers))); });

        // Send Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});
            const sendTo = po.ic_email ? po.ic_email : process.env.EMAIL_USER;
            
            let itemsHtml = po.itemized_lines.map(item => `<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item_name}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.qty}</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">$${item.line_total.toFixed(2)}</td></tr>`).join('');

            await transporter.sendMail({
                from: `"Spotlight Tile LLC" <${process.env.EMAIL_USER}>`,
                to: sendTo, cc: process.env.EMAIL_USER,
                subject: `Purchase Order PO-${po.id} from Spotlight Tile LLC`,
                html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 20px;">
                    <div style="text-align: center;"><img src="https://spotlight-tile.com/image.png" alt="Spotlight Tile" width="160"></div>
                    <h2 style="color: #1565c0; text-align: center;">Purchase Order (PO-${po.id})</h2>
                    <p><strong>Contractor:</strong> ${po.ic_name}<br><strong>Site:</strong> ${po.client_address || po.client_name}</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left;">
                        <thead><tr style="background: #e3f2fd;"><th style="padding: 10px;">Scope</th><th style="padding: 10px;">Qty</th><th style="padding: 10px;">Total</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <h3 style="text-align: right; margin-top: 20px;">Total Payout: $${po.total_amount.toFixed(2)}</h3>
                    ${po.comments ? `<div style="background:#f9f9f9; padding:15px; margin-top:20px;"><strong>Instructions:</strong><br>${po.comments}</div>` : ''}
                    <p style="color: #666; font-size: 0.9em; margin-top: 30px; text-align: center;">Please find the official PO attached as a PDF. Contact Richard with any questions.</p>
                </div>`,
                attachments: [{ filename: `Spotlight_Tile_PO_${po.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
            });
        }
        await supabase.from('purchase_orders').update({ status: 'Sent' }).eq('id', id);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};