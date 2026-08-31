const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    try {
        const { category, amount, description, vendor_name } = JSON.parse(event.body);
        let finalAmount = category === 'Company Meals (50% Deductible)' ? parseFloat(amount) * 0.5 : parseFloat(amount);
        const { error } = await supabase.from('expenses').insert([{ category, amount: finalAmount, description, vendor_name }]);
        if (error) throw error; return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};