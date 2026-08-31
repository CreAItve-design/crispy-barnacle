const nodemailer = require('nodemailer');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { startDate, endDate, rev, exp, net, breakdownHtml } = JSON.parse(event.body);

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            await transporter.sendMail({
                from: `"Spotlight System" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                subject: `P&L Report: Spotlight Tile LLC`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; padding: 20px;">
                        <h2 style="color: #111; border-bottom: 2px solid #111; padding-bottom: 10px;">Profit & Loss Report</h2>
                        <p><strong>Date Range:</strong> ${startDate || 'All Time'} to ${endDate || 'Present'}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                            <tr style="background: #f4f6f9;"><th style="padding: 10px; text-align: left;">Category</th><th style="padding: 10px; text-align: right;">Amount</th></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Revenue</strong></td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">${rev}</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Expenses</strong></td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">${exp}</td></tr>
                            <tr style="background: #e8f5e9;"><td style="padding: 10px;"><strong>Net Operating Profit</strong></td><td style="padding: 10px; text-align: right; color: #2e7d32;"><strong>${net}</strong></td></tr>
                        </table>
                        
                        <h3 style="margin-top: 30px;">Expense Breakdown</h3>
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 6px;">
                            ${breakdownHtml}
                        </div>
                    </div>
                `
            });
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};