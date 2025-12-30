require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function getTicket() {
    try {
        const res = await pool.query("SELECT qr_code FROM tickets WHERE status = 'PAID' OR status = 'PENDING' LIMIT 1");
        if (res.rows.length > 0) {
            console.log("TICKET_CODE:" + res.rows[0].qr_code);
        } else {
            console.log("NO_TICKETS_FOUND");
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

getTicket();
