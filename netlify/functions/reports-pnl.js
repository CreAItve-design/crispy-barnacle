const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.handler = async (event) => {
    try {
        const { startDate, endDate } = event.queryStringParameters || {};
        let invQ = supabase.from('invoices').select('*');
        let expQ = supabase.from('expenses').select('*');
        let poQ = supabase.from('purchase_orders').select('*');

        if (startDate) { invQ = invQ.gte('created_at', startDate); expQ = expQ.gte('created_at', startDate); poQ = poQ.gte('created_at', startDate); }
        if (endDate) { 
            const end = new Date(endDate); end.setDate(end.getDate() + 1); 
            invQ = invQ.lt('created_at', end.toISOString()); expQ = expQ.lt('created_at', end.toISOString()); poQ = poQ.lt('created_at', end.toISOString());
        }

        const [invData, expData, poData] = await Promise.all([invQ, expQ, poQ]);

        let totalRevenue = 0; let autoMat = 0;
        invData.data.forEach(inv => {
            let rev = inv.status === 'Paid' ? inv.total_amount : (inv.deposit_paid || 0);
            totalRevenue += rev;
            if (rev > 0 && inv.itemized_lines) {
                inv.itemized_lines.forEach(line => { if (line.base_cost && line.base_cost < line.unit_price) autoMat += (line.base_cost * line.qty); });
            }
        });

        let expByCat = {}; let totalExpenses = 0; let cTotals = {};
        if (autoMat > 0) { expByCat["Materials (COGS)"] = autoMat; totalExpenses += autoMat; }

        expData.data.forEach(exp => {
            const cat = exp.category || 'Other';
            expByCat[cat] = (expByCat[cat] || 0) + exp.amount; totalExpenses += exp.amount;
            if (cat === '1099 Contractor / IC' && exp.vendor_name) {
                let v = exp.vendor_name.trim().toLowerCase(); cTotals[v] = (cTotals[v] || 0) + exp.amount;
            }
        });

        poData.data.forEach(po => {
            expByCat['Purchase Orders (IC Labor)'] = (expByCat['Purchase Orders (IC Labor)'] || 0) + po.total_amount;
            totalExpenses += po.total_amount;
            if (po.ic_name) { let v = po.ic_name.trim().toLowerCase(); cTotals[v] = (cTotals[v] || 0) + po.total_amount; }
        });

        let flags1099 = Object.entries(cTotals).filter(([_, amt]) => amt >= 600).map(([n, a]) => `${n.toUpperCase()}: $${a.toFixed(2)}`);
        return { statusCode: 200, body: JSON.stringify({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, expensesByCategory: expByCat, flags1099 }) };
    } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};