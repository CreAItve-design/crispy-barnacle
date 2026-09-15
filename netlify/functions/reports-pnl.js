const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    try {
        const { startDate, endDate } = event.queryStringParameters || {};
        let invQ = supabase.from('invoices').select('*');
        let expQ = supabase.from('expenses').select('*');
        let poQ = supabase.from('purchase_orders').select('*');

        if (startDate) { 
            invQ = invQ.gte('issue_date', startDate); 
            expQ = expQ.gte('created_at', startDate); 
            poQ = poQ.gte('created_at', startDate); 
        }
        if (endDate) { 
            const end = new Date(endDate); end.setDate(end.getDate() + 1); 
            invQ = invQ.lt('issue_date', end.toISOString()); 
            expQ = expQ.lt('created_at', end.toISOString()); 
            poQ = poQ.lt('created_at', end.toISOString());
        }

        const [invData, expData, poData] = await Promise.all([invQ, expQ, poQ]);

        let totalRevenue = 0; 
        let expByCat = {
            "Materials (COGS)": 0,
            "Labor": 0,
            "Job Supplies": 0,
            "Subcontractors": 0,
            "Owner's Pay": 0,
            "Office Expenses": 0,
            "Meals": 0,
            "Fees and Services": 0,
            "Maintenance / Repairs": 0,
            "Tools / Equipment": 0,
            "Other": 0
        };
        let totalExpenses = 0; 
        let cTotals = {};
        
        invData.data.forEach(inv => {
            let rev = inv.status === 'Paid' ? inv.total_amount : (inv.deposit_paid || 0);
            totalRevenue += rev;
            
            if (rev > 0 && inv.itemized_lines) {
                inv.itemized_lines.forEach(line => { 
                    let cat = line.category ? line.category.toLowerCase() : '';
                    let cost = (line.base_cost || 0) * (line.qty || 1);
                    
                    if (cost > 0) {
                        // COGS mapping logic from invoices
                        if (cat.includes('material') || (line.base_cost < line.unit_price)) {
                            expByCat["Materials (COGS)"] += cost;
                            totalExpenses += cost;
                        } 
                    }
                });
            }
        });

        expData.data.forEach(exp => {
            let catName = exp.category || 'Other';
            let catLower = catName.toLowerCase();
            let bucket = "Other";

            if (catLower.includes('material') || catLower.includes('cogs')) bucket = "Materials (COGS)";
            else if (catLower.includes('job supplies')) bucket = "Job Supplies";
            else if (catLower.includes('1099') || catLower.includes('subcontractor') || catLower.includes('ic')) bucket = "Subcontractors";
            else if (catLower.includes('payroll') || catLower.includes('owner')) bucket = "Owner's Pay";
            else if (catLower.includes('office') || catLower.includes('software') || catLower.includes('technology') || catLower.includes('utilities')) bucket = "Office Expenses";
            else if (catLower.includes('meal')) bucket = "Meals";
            else if (catLower.includes('tax') || catLower.includes('accounting') || catLower.includes('credit card') || catLower.includes('debt') || catLower.includes('fee') || catLower.includes('service')) bucket = "Fees and Services";
            else if (catLower.includes('repair') || catLower.includes('maintenance') || catLower.includes('vehicle') || catLower.includes('fuel')) bucket = "Maintenance / Repairs";
            else if (catLower.includes('tool') || catLower.includes('equipment')) bucket = "Tools / Equipment";
            else if (catLower.includes('labor')) bucket = "Labor";

            expByCat[bucket] += exp.amount; 
            totalExpenses += exp.amount;

            // 1099 Tracking
            if (bucket === 'Subcontractors' && exp.vendor_name) {
                let v = exp.vendor_name.trim().toLowerCase(); 
                cTotals[v] = (cTotals[v] || 0) + exp.amount;
            }
        });

        poData.data.forEach(po => {
            expByCat['Subcontractors'] += po.total_amount;
            totalExpenses += po.total_amount;
            if (po.ic_name) { 
                let v = po.ic_name.trim().toLowerCase(); 
                cTotals[v] = (cTotals[v] || 0) + po.total_amount; 
            }
        });

        let flags1099 = Object.entries(cTotals).filter(([_, amt]) => amt >= 600).map(([n, a]) => `${n.toUpperCase()}: $${a.toFixed(2)}`);
        
        // Clean up empty categories
        for (let key in expByCat) {
            if (expByCat[key] === 0) delete expByCat[key];
        }

        return { statusCode: 200, body: JSON.stringify({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, expensesByCategory: expByCat, flags1099 }) };
    } catch (e) { 
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; 
    }
};