const db = require('../config/database');

async function checkPendingData() {
    console.log('🔍 Checking PENDING tickets and their payment refs...');

    try {
        const result = await db.query(`
            SELECT t.id, t.status, t.created_at, 
                   p.id as payment_id, p.status as payment_status, p.esewa_ref
            FROM tickets t
            LEFT JOIN payments p ON t.id = p.ticket_id
            WHERE t.status = 'PENDING'
            ORDER BY t.created_at DESC
            LIMIT 5
        `);

        console.log(`Found ${result.rows.length} pending tickets:`);
        console.table(result.rows);

    } catch (error) {
        console.error('❌ Error querying database:', error);
    } finally {
        await db.pool.end();
    }
}

checkPendingData();
