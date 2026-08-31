const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    try {
        const { startDate, endDate } = event.queryStringParameters || {};
        let invQuery = supabase.from('invoices').select('*');
        let expQuery = supabase.from('expenses').select('*');

        // Apply Date Filters if provided
        if (startDate) {
            invQuery = invQuery.gte('created_at', startDate);
            expQuery = expQuery.gte('created_at', startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Include the full end day
            invQuery = invQuery.lt('created_at', end.toISOString());
            expQuery = expQuery.lt('created_at', end.toISOString());
        }

        const [invData, expData] = await Promise.all([invQuery, expQuery]);

        let totalRevenue = 0;
        let autoMaterialExpense = 0;
        
        // 1. Calculate Revenue & Auto-Extract Material Costs
        invData.data.forEach(inv => {
            let recognizedRevenue = 0;
            if (inv.status === 'Paid') {
                recognizedRevenue = inv.total_amount;
            } else if (inv.deposit_paid > 0) {
                recognizedRevenue = inv.deposit_paid; // Count deposits on Unpaid invoices!
            }
            totalRevenue += recognizedRevenue;

            // If money was collected, log the base cost of materials as an expense
            if (recognizedRevenue > 0 && inv.itemized_lines) {
                inv.itemized_lines.forEach(line => {
                    // We look for base_cost (which doesn't include the 20% markup)
                    if (line.base_cost && line.base_cost < line.unit_price) {
                        autoMaterialExpense += (line.base_cost * line.qty);
                    }
                });
            }
        });

        let expensesByCategory = {};
        let totalExpenses = 0;

        // Add Auto-Calculated Material Costs
        if (autoMaterialExpense > 0) {
            expensesByCategory["Materials (Auto-Extracted from Invoices)"] = autoMaterialExpense;
            totalExpenses += autoMaterialExpense;
        }

        // 2. Add Manually Logged Expenses
        expData.data.forEach(exp => {
            const cat = exp.category || 'Other';
            if (!expensesByCategory[cat]) expensesByCategory[cat] = 0;
            expensesByCategory[cat] += exp.amount;
            totalExpenses += exp.amount;
        });

        const netProfit = totalRevenue - totalExpenses;

        return { statusCode: 200, body: JSON.stringify({ totalRevenue, totalExpenses, netProfit, expensesByCategory }) };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};