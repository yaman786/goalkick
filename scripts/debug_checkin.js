const axios = require('axios');
const wrapper = axios.create({
    baseURL: 'http://localhost:3000',
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0, // Handle redirects manually if needed
    validateStatus: (status) => status >= 200 && status < 400
});

async function debugCheckIn() {
    console.log('🔐 Logging in as admin...');
    // 1. Get a valid paid ticket
    // This assumes there is at least one PAID ticket.
    // If not, we might need to create one first, but let's try reading.

    // We can't easily query DB directly here without pg setup, so we'll use an existing known ticket or fetch via API if possible.
    // Let's assume the user provided ID 'NEP-MJTUULCHFDMJ' is the CODE.
    // Wait, the API takes ticket_ID (internal UUID), not CODE.
    // Ah! The scanner.js logic:
    // 1. validates code -> gets ticket object (with ID)
    // 2. calls check_in with ID.

    // So if I send CODE to check_in, it will fail (type mismatch UUID vs string).
    // Let's check what validate returns.

    try {
        // Login to get session cookie
        const loginRes = await wrapper.post('/admin/login', {
            username: 'admin',
            password: 'admin123'
        });

        let cookies = loginRes.headers['set-cookie'];
        const cookieHeader = cookies ? cookies.join('; ') : '';
        console.log('✅ Logged in.');

        // 0. Get a real local PAID ticket
        // We can query the admin search API or just validate a known bad one... 
        // Better: create one or search.
        // Let's search via Admin Ticket API if possible, or just trying "NEP-..." which we don't have.
        // I will assume for now I can't hit the DB directly.
        // Let's use the 'validation' endpoint to brute force? No.
        // Let's use the admin tickets page content? No.

        // Let's look for a ticket using the admin API that lists matches/tickets?
        // Let's try to "Buy" a ticket first to ensure we have one! 
        // But buying needs eSewa... 

        // Let's try to find a PENDING ticket and manually mark it PAID via SQL? 
        // I can't run SQL here easily.

        // Let's assume there is at least ONE ticket. I will try to list them via Admin?
        // Is there an admin API for tickets?
        // GET /admin/tickets returns HTML.

        // Let's use the `get_test_tickets.js` script I saw earlier? 
        // It requires `db` config which I can use here if I allow 'pg' usage.

        // OK, I'll cheat and use 'pg' directly since I am in "scripts" folder and I can require local modules.
        const db = require('../config/database');
        const res = await db.query("SELECT qr_code FROM tickets WHERE status = 'PAID' LIMIT 1");

        if (res.rows.length === 0) {
            console.error('❌ No PAID tickets found in local DB. Cannot reproduce.');
            process.exit(0);
        }

        const code = res.rows[0].qr_code;
        console.log(`\n🔍 1. Validating Valid Local Code: ${code}`);

        const valRes = await wrapper.post('/validate_ticket', { code }, {
            headers: { Cookie: cookieHeader }
        });

        console.log('Validation Response:', valRes.data);

        if (!valRes.data.valid || !valRes.data.ticket) {
            console.error('❌ Ticket not found/valid. (Might not exist in local DB?)');
            return;
        }

        const ticketId = valRes.data.ticket.id;
        console.log(`✅ Got Ticket ID: ${ticketId}`);

        // 2. Attempt Check-in
        console.log(`\n📥 2. Attempting Check-in for ID: ${ticketId}`);
        const checkInRes = await wrapper.post('/gatekeeper/check_in', {
            ticket_id: ticketId,
            count: 1
        }, {
            headers: { Cookie: cookieHeader }
        });

        console.log('Check-in Response:', checkInRes.data);

    } catch (error) {
        if (error.response) {
            console.error('❌ Request Failed:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

debugCheckIn();
