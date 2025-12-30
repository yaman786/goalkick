const db = require('../config/database');
// uuid not needed, DB handles ID generation

(async () => {
    try {
        console.log('🎫 Generating DEMO Golden Ticket...');
        const client = await db.getClient();

        // 1. Get the first active match
        const matchRes = await client.query("SELECT id, team_home, team_away, price FROM matches WHERE is_active = true LIMIT 1");
        if (matchRes.rows.length === 0) {
            console.error('❌ No active matches found! Please create a match first.');
            process.exit(1);
        }
        const match = matchRes.rows[0];

        // 2. Create or Get Demo User
        let userId;
        const userRes = await client.query("SELECT id FROM users WHERE phone = '9800000000'");
        if (userRes.rows.length > 0) {
            userId = userRes.rows[0].id;
        } else {
            const newUser = await client.query("INSERT INTO users (name, phone) VALUES ('Demo Client', '9800000000') RETURNING id");
            userId = newUser.rows[0].id;
        }

        // 3. Create Ticket (QTY 5 for Partial Demo)
        const qrCode = 'DEMO-GOLDEN-TICKET';
        const qty = 5;
        const totalAmount = parseFloat(match.price) * qty;

        const ticketRes = await client.query(`
            INSERT INTO tickets (user_id, match_id, quantity, total_amount, status, qr_code, created_at, used_count)
            VALUES ($1, $2, $3, $4, 'PAID', $5, NOW(), 0)
            RETURNING id
        `, [userId, match.id, qty, totalAmount, qrCode]);

        const ticketId = ticketRes.rows[0].id;

        // 4. Create Payment Record (Approved)
        await client.query(`
            INSERT INTO payments (ticket_id, amount, status, esewa_ref)
            VALUES ($1, $2, 'COMPLETE', 'DEMO-REF-123')
        `, [ticketId, totalAmount]);

        console.log(`
✅ GOLDEN TICKET CREATED!
----------------------------------
Match:  ${match.team_home} vs ${match.team_away}
Code:   ${qrCode}
Qty:    ${qty}
Ref:    DEMO-REF-123
User:   Demo Client (9800000000)
----------------------------------
👉 Use this code '${qrCode}' in the Gatekeeper for your demo.
        `);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
})();
