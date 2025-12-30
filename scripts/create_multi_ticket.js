const db = require('../config/database');

async function createMultiTicket() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Create user
        const randomPhone = '98' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const userRes = await client.query("INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id", [randomPhone, 'Multi Ticket User']);
        const userId = userRes.rows[0].id;

        // Get Match
        let matchRes = await client.query("SELECT id, price FROM matches LIMIT 1");
        if (matchRes.rows.length === 0) {
            console.log("No match found.");
            return;
        }
        const match = matchRes.rows[0];

        // Create Ticket (Qty 3, PAID)
        const qr = 'MULTI-' + Date.now().toString().slice(-6);
        const qty = 3;
        const total = match.price * qty;

        const ticketRes = await client.query(`
            INSERT INTO tickets (
                user_id, match_id, quantity, total_amount, status, qr_code, used_count
            )
            VALUES ($1, $2, $3, $4, 'PAID', $5, 0)
            RETURNING id, qr_code
        `, [userId, match.id, qty, total, qr]);

        const ticket = ticketRes.rows[0];

        // Create Payment
        await client.query(`
            INSERT INTO payments (ticket_id, amount, status, esewa_ref)
            VALUES ($1, $2, 'COMPLETE', 'TEST-REF-${qr}')
        `, [ticket.id, total]);

        await client.query('COMMIT');

        console.log(`✅ Created Multi-Ticket (Qty: 3)`);
        console.log(`🎫 QR Code: ${ticket.qr_code}`);
        console.log(`📱 Phone: 9800000000`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error);
    } finally {
        client.release();
        process.exit();
    }
}

createMultiTicket();
