const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TICKET_CODE = 'MULTI-413168';

async function verifyFlow() {
    try {
        console.log(`🔐 Logging in as Admin...`);

        // 1. Login to get session cookie
        const loginRes = await axios.post(`${BASE_URL}/admin/login`, {
            username: 'testadmin',
            password: 'testpass'
        }, {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });

        // Extract session cookie
        const cookies = loginRes.headers['set-cookie'];
        if (!cookies) {
            console.error('❌ Login failed: No cookies received');
            return;
        }
        const sessionCookie = cookies.find(c => c.startsWith('connect.sid'));
        console.log(`✅ Login successful. Session: ${sessionCookie.split(';')[0]}`);

        const config = {
            headers: {
                'Cookie': sessionCookie
            }
        };

        // 2. Validate Ticket
        console.log(`\n1️⃣  Validating Ticket: ${TICKET_CODE}`);
        const valRes = await axios.post(`${BASE_URL}/validate_ticket`, { code: TICKET_CODE }, config);

        if (!valRes.data.valid) {
            console.error('❌ Validation failed:', valRes.data);
            return;
        }

        const ticketId = valRes.data.ticket.id;
        console.log(`✅ Validation successful. Ticket ID: ${ticketId}`);
        console.log(`   Initial State: Used=${valRes.data.ticket.usedCount}, Remaining=${valRes.data.ticket.remaining}`);

        // 3. Check In
        console.log(`\n2️⃣  Checking In 1 Person...`);
        const checkInRes = await axios.post(`${BASE_URL}/gatekeeper/check_in`, {
            ticket_id: ticketId,
            count: 1
        }, config);

        if (!checkInRes.data.success) {
            console.error('❌ Check-in failed:', checkInRes.data);
            return;
        }
        console.log(`✅ Check-in successful: ${checkInRes.data.message}`);

        // 4. Verify State Change
        console.log(`\n3️⃣  Re-validating to confirm state change...`);
        const reValRes = await axios.post(`${BASE_URL}/validate_ticket`, { code: TICKET_CODE }, config);

        console.log(`   New State: Used=${reValRes.data.ticket.usedCount}, Remaining=${reValRes.data.ticket.remaining}`);

        if (parseInt(reValRes.data.ticket.usedCount) === 1 && parseInt(reValRes.data.ticket.remaining) === 2) {
            console.log('\n✅ VERIFICATION PASSED: Gatekeeper flow works correctly.');
        } else {
            console.error('\n❌ VERIFICATION FAILED: Counts did not update correctly.');
        }

    } catch (error) {
        console.error('❌ Error running verification:', error.message);
        if (error.response) {
            console.error('   Server Response:', error.response.data);
        }
    }
}

verifyFlow();
