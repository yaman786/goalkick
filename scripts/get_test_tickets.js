const db = require('../config/database');

async function getTestTickets() {
    try {
        // Get a PENDING ticket
        const pending = await db.query("SELECT id, status FROM tickets WHERE status = 'PENDING' LIMIT 1");

        // Get a PAID ticket
        const paid = await db.query("SELECT id, status FROM tickets WHERE status = 'PAID' LIMIT 1");

        console.log('PENDING Ticket:', pending.rows[0] ? pending.rows[0].id : 'None found');
        console.log('PAID Ticket:', paid.rows[0] ? paid.rows[0].id : 'None found');

        // If no PENDING, create one? For now just report.
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getTestTickets();
