const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        // 1. Fetch all paid invoices for total revenue
        const { data: invoices, error: invError } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'Paid');

        if (invError) throw invError;

        const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

        // 2. Fetch all expenses for total cost calculation
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('amount, category');

        if (expError) throw expError;

        const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        // 3. Group expenses by category (e.g., Materials, Tools, Travel)
        const expensesByCategory = expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
            return acc;
        }, {});

        // 4. Calculate Net Profit
        const netProfit = totalRevenue - totalExpenses;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                totalRevenue,
                totalExpenses,
                netProfit,
                expensesByCategory
            })
        };

    } catch (error) {
        console.error('P&L Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};