exports.handler = async () => {
    if (!process.env.SUPABASE_URL) return { statusCode: 500, body: JSON.stringify({ error: 'Missing URL Env Var' }) };
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
    const headers = {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    };
    
    try {
        const [invRes, expRes] = await Promise.all([
            fetch(`${baseUrl}/rest/v1/invoices?select=total_amount&status=eq.Paid`, { headers }),
            fetch(`${baseUrl}/rest/v1/expenses?select=amount,category`, { headers })
        ]);

        const invoices = await invRes.json();
        const expenses = await expRes.json();

        const totalRevenue = (invoices || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const totalExpenses = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount), 0);
        
        const expensesByCategory = (expenses || []).reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
            return acc;
        }, {});

        return {
            statusCode: 200,
            body: JSON.stringify({
                totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, expensesByCategory
            })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};