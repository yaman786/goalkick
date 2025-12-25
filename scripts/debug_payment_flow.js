const db = require('../config/database');

async function testFlow() {
    const client = await db.getClient();
    let ticketId;

    try {
        console.log('🚀 Starting Payment Flow Debug...');

        // 1. Simulate Ticket Reservation (POST /buy_ticket)
        console.log('1️⃣ Creating Ticket...');
        const userRes = await client.query("INSERT INTO users (name, phone) VALUES ('Debug User', '9999999999') RETURNING id");
        const userId = userRes.rows[0].id;

        // Find a match
        const matchRes = await client.query("SELECT id FROM matches WHERE is_active = true LIMIT 1");
        if (matchRes.rows.length === 0) throw new Error("No active matches found");
        const matchId = matchRes.rows[0].id;

        const ticketRes = await client.query(`
            INSERT INTO tickets (user_id, match_id, quantity, total_amount, status, qr_code)
            VALUES ($1, $2, 1, 100, 'PENDING', 'DEBUG-QR')
            RETURNING id
        `, [userId, matchId]);
        ticketId = ticketRes.rows[0].id;

        await client.query("INSERT INTO payments (ticket_id, amount, status) VALUES ($1, 100, 'PENDING')", [ticketId]);
        console.log(`✅ Ticket Created: ${ticketId}`);

        // 2. Simulate User Confirming Payment (POST /confirm_payment)
        console.log('2️⃣ Submitting eSewa Manual Ref...');
        const manualRef = 'MANUAL-TEST-' + Date.now();

        // The Logic from routes/tickets.js:
        await client.query(`
            UPDATE payments SET esewa_ref = $1, status = 'AWAITING_VERIFICATION'
            WHERE ticket_id = $2
        `, [manualRef, ticketId]);
        console.log(`✅ Payment Updated with Ref: ${manualRef}`);

        // 3. Verify Admin View Logic
        console.log('3️⃣ Checking Admin Query Result...');
        const adminQuery = `
            SELECT t.id, t.status, p.esewa_ref as esewa_transaction_id
            FROM tickets t
            LEFT JOIN payments p ON t.id = p.ticket_id
            WHERE t.id = $1
        `;
        const result = await client.query(adminQuery, [ticketId]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('🔍 DB Result:', row);
            if (row.esewa_transaction_id === manualRef) {
                console.log('✅ SUCCESS: Admin logic correctly fetches the manual ref!');
            } else {
                console.error('❌ FAILURE: Ref mismatch or missing.');
            }
        } else {
            console.error('❌ FAILURE: Record not found.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        // Cleanup
        if (ticketId) {
            await client.query("DELETE FROM payments WHERE ticket_id = $1", [ticketId]);
            await client.query("DELETE FROM tickets WHERE id = $1", [ticketId]);
            await client.query("DELETE FROM users WHERE phone = '9999999999'");
        }
        client.release();
        process.exit();
    }
}

testFlow();
