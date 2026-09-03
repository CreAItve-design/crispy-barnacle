const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { id } = JSON.parse(event.body);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', id).single();

        if (error || !invoice) throw new Error('Invoice not found');

        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

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

        doc.fontSize(16).text(invoice.status === 'Paid' ? `RECEIPT #${invoice.id}` : `INVOICE #${invoice.id}`);
        doc.fontSize(10).text(`Date: ${new Date(invoice.created_at || invoice.issue_date || new Date()).toLocaleDateString()}`);
        doc.moveDown();
        
        doc.text(`Bill To: ${invoice.client_name}`);
        if (invoice.client_email) doc.text(`Email: ${invoice.client_email}`);
        if (invoice.client_phone) doc.text(`Phone: ${invoice.client_phone}`);
        if (invoice.client_address) doc.text(`Address: ${invoice.client_address}`);
        if (invoice.po_job_name) doc.text(`Project / PO: ${invoice.po_job_name}`);
        doc.moveDown(2);

        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item Description', 50, tableTop);
        doc.text('Qty', 350, tableTop, { width: 50, align: 'center' });
        doc.text('Line Total', 420, tableTop, { width: 80, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
        
        doc.font('Helvetica');
        let y = tableTop + 25;
        invoice.itemized_lines.forEach(item => {
            doc.text(item.item_name, 50, y, { width: 280 });
            doc.text(item.qty.toString(), 350, y, { width: 50, align: 'center' });
            doc.text(`$${item.line_total.toFixed(2)}`, 420, y, { width: 80, align: 'right' });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(500, y + 10).stroke();
        y += 20;
        
        doc.font('Helvetica-Bold');
        doc.text(`Total Amount: $${invoice.total_amount.toFixed(2)}`, 250, y, { width: 250, align: 'right' });
        
        const deposit = parseFloat(invoice.deposit_paid || 0);
        let balanceDue = invoice.total_amount - deposit;

        // --- NEW "PAID IN FULL" ZERO-OUT LOGIC ---
        if (invoice.status === 'Paid') {
            balanceDue = 0;
            y += 25;
            doc.fillColor('#2e7d32').fontSize(16).text('PAID IN FULL', 250, y, { width: 250, align: 'right' }).fillColor('#111111');
            y += 20;
            doc.fontSize(14).font('Helvetica-Bold').text(`Balance Due: $0.00`, 250, y, { width: 250, align: 'right' });
        } else {
            if (deposit > 0) {
                y += 20;
                doc.font('Helvetica').fillColor('#c62828');
                doc.text(`Less Deposit Paid: -$${deposit.toFixed(2)}`, 250, y, { width: 250, align: 'right' });
                doc.fillColor('#111111');
            }
            y += 20;
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text(`Balance Due: $${balanceDue.toFixed(2)}`, 250, y, { width: 250, align: 'right' });
        }

        if (invoice.comments) {
            y += 40;
            doc.fontSize(10).font('Helvetica-Bold').text('Notes / Instructions:', 50, y);
            doc.font('Helvetica').text(invoice.comments, 50, y + 15, { width: 450 });
        }

        doc.end();

        const pdfBuffer = await new Promise((resolve) => {
            doc.on('end', () => { resolve(Buffer.concat(buffers)); });
        });

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const sendTo = invoice.client_email ? invoice.client_email : process.env.EMAIL_USER;
            
            // Format HTML Email correctly based on Status
            let balanceHtml = invoice.status === 'Paid'
                ? `<h2 style="color: #2e7d32; margin-bottom: 5px;">PAID IN FULL</h2><p style="margin-top: 0;"><strong>Balance Due: $0.00</strong></p>`
                : `<p><strong>Total Balance Due: $${balanceDue.toFixed(2)}</strong></p>`;

            await transporter.sendMail({
                from: `"Spotlight Tile LLC" <${process.env.EMAIL_USER}>`,
                to: sendTo,
                cc: process.env.EMAIL_USER,
                subject: invoice.status === 'Paid' ? `Receipt: Invoice #${invoice.id} - Spotlight Tile LLC` : `Invoice #${invoice.id} - Spotlight Tile LLC`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Hello ${invoice.client_name},</h2>
                        <p>Thank you for choosing Spotlight Tile LLC. Please find your detailed ${invoice.status === 'Paid' ? 'receipt' : 'invoice'} attached to this email as a PDF.</p>
                        
                        ${balanceHtml}
                        
                        ${invoice.comments ? `<div style="background:#f9f9f9; padding:15px; margin-top:20px; border-left:4px solid #111;"><strong>Notes:</strong><br>${invoice.comments.replace(/\n/g, '<br>')}</div>` : ''}
                        
                        <p style="margin-top:20px;">If you have any questions or concerns, please reply directly to this email.</p>
                        <br>
                        <p>Best regards,<br>Spotlight Tile LLC</p>
                    </div>
                `,
                attachments: [
                    {
                        filename: `Spotlight_Tile_${invoice.status === 'Paid' ? 'Receipt' : 'Invoice'}_${invoice.id}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            });
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};