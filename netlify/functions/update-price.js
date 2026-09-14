const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'PUT') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { id, new_price } = JSON.parse(event.body);

        // 1. Fetch the existing item
        const { data: currentItem, error: fetchErr } = await supabase.from('price_sheet').select('*').eq('id', id).single();
        if (fetchErr || !currentItem) throw new Error('Item not found');

        // 2. Save a copy of the old rate as (Archived)
        const archivedName = currentItem.item_name.includes('(Archived)') ? currentItem.item_name : `${currentItem.item_name} (Archived)`;
        await supabase.from('price_sheet').insert([{
            item_name: archivedName,
            category: currentItem.category,
            unit: currentItem.unit,
            unit_price: currentItem.unit_price
        }]);

        // 3. Update the active item with the new rate
        const { error: updateErr } = await supabase.from('price_sheet').update({ unit_price: parseFloat(new_price) }).eq('id', id);
        if (updateErr) throw updateErr;

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};