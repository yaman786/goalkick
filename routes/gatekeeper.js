/**
 * GoalKick Lite - Gatekeeper Routes
 * QR code scanning and ticket validation
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireGatekeeper } = require('../middleware/adminAuth');

// Protect all Gatekeeper routes
router.use('/gatekeeper', requireGatekeeper);
router.use('/validate_ticket', requireGatekeeper); // Also protect API endpoint
router.use('/validate', requireGatekeeper);

/**
 * GET /gatekeeper - Mobile QR scanner page
 */
router.get('/gatekeeper', (req, res) => {
    res.render('gatekeeper', {
        title: 'Gatekeeper Scanner'
    });
});

/**
 * POST /validate_ticket - Validate a scanned QR code
 * 
 * Body parameters:
 * - code: The QR code value (e.g., NEP-8X92)
 * 
 * Response:
 * - valid: true/false
 * - status: 'ENTER' | 'ALREADY_USED' | 'INVALID' | 'UNPAID'
 * - message: Human-readable message
 * - ticket: Ticket details (if valid)
 */
router.post('/validate_ticket', async (req, res) => {
    const client = await db.getClient();

    try {
        const { code } = req.body;

        if (!code) {
            return res.json({
                valid: false,
                status: 'INVALID',
                message: 'No ticket code provided'
            });
        }

        // Clean the code (remove whitespace, convert to uppercase)
        const cleanCode = code.trim().toUpperCase();

        console.log(`🎫 Validating ticket: ${cleanCode}`);

        // Start transaction for atomic check-and-update
        await client.query('BEGIN');

        // Fetch ticket with row lock (only lock tickets table, not outer joined users)
        const result = await client.query(`
            SELECT t.*, m.team_home, m.team_away, m.match_date, m.venue,
                   u.name as user_name, u.phone as user_phone
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.qr_code = $1
            FOR UPDATE OF t
        `, [cleanCode]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            console.log(`❌ Invalid ticket code: ${cleanCode}`);
            return res.json({
                valid: false,
                status: 'INVALID',
                message: 'Invalid ticket code'
            });
        }

        // ... (previous code)

        const ticket = result.rows[0];

        // LOGGING FOR DEBUGGING
        console.log(`🎫 Found ticket: ID=${ticket.id} Code=${ticket.qr_code} Status=${ticket.status} UsedCount=${ticket.used_count} Qty=${ticket.quantity} UsedAt=${ticket.used_at}`);

        // Check if ticket is paid
        if (ticket.status !== 'PAID') {
            await client.query('ROLLBACK');
            console.log(`⚠️ Unpaid ticket: ${cleanCode} (Status: ${ticket.status})`);
            return res.json({
                valid: false,
                status: 'UNPAID',
                message: `Ticket is ${ticket.status}. Payment not completed.`
            });
        }

        // Initialize used_count if null (legacy support)
        let usedCount = ticket.used_count || 0;
        // If used_count is 0 but used_at is set, it means it was fully used before migration
        if (usedCount === 0 && ticket.used_at !== null) {
            usedCount = ticket.quantity;
        }

        const totalQty = ticket.quantity;
        const remainingQty = totalQty - usedCount;

        // Check availability
        if (remainingQty <= 0) {
            await client.query('ROLLBACK');
            const usedTime = ticket.used_at ? new Date(ticket.used_at).toLocaleString('en-NP') : 'Unknown';
            console.log(`🚫 Matches used ticket: ${cleanCode}. Used: ${usedCount}/${totalQty}`);
            return res.json({
                valid: false,
                status: 'ALREADY_USED',
                message: `Ticket already fully used (${usedCount}/${totalQty})`,
                ticket: {
                    code: cleanCode,
                    match: `${ticket.team_home} vs ${ticket.team_away}`,
                    usedAt: ticket.used_at,
                    qty: totalQty,
                    used: usedCount
                }
            });
        }

        // ============================================
        // TICKET IS VALID - RETURN INFO FOR DECISION
        // ============================================

        // We DO NOT mark as used here anymore. We return "partial" status so user can choose quantity.

        await client.query('COMMIT'); // Commit the read (no writes made yet)

        console.log(`✅ Ticket valid for entry: ${cleanCode} - Remaining: ${remainingQty}`);

        const isSingle = totalQty === 1;

        return res.json({
            valid: true,
            status: 'VALID',
            partial: true, // Signal frontend to show options
            isSingle: isSingle, // UI Flag: True if single ticket, False if multi
            message: `Valid Ticket! (${remainingQty}/${totalQty} remaining)`,
            ticket: {
                id: ticket.id,
                code: cleanCode,
                match: `${ticket.team_home} vs ${ticket.team_away}`,
                matchDate: ticket.match_date,
                venue: ticket.venue,
                quantity: totalQty,
                usedCount: usedCount,
                remaining: remainingQty,
                userName: ticket.user_name || 'Guest'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ticket validation error:', error);
        return res.json({
            valid: false,
            status: 'ERROR',
            message: 'An error occurred while validating the ticket'
        });
    } finally {
        client.release();
    }
});

/**
 * POST /gatekeeper/check_in - Process the check-in
 * Body: { ticket_id, count }
 */
router.post('/gatekeeper/check_in', requireGatekeeper, async (req, res) => {
    const client = await db.getClient();
    try {
        const { ticket_id, count } = req.body;
        const checkInCount = parseInt(count) || 1;

        console.log(`📥 Check-in request received: TicketID=${ticket_id}, RequestedCount=${checkInCount}`);

        // 1. Strict Input Validation
        if (!ticket_id) {
            return res.status(400).json({ success: false, message: 'Missing Ticket ID' });
        }
        if (checkInCount < 1) {
            return res.status(400).json({ success: false, message: 'Invalid count' });
        }

        await client.query('BEGIN');

        // Lock the row
        const result = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticket_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error(`❌ Check-in failed: Ticket ID ${ticket_id} not found.`);
            return res.json({ success: false, message: 'Ticket not found' });
        }

        const ticket = result.rows[0];
        console.log(`🔍 Current DB State: Qty=${ticket.quantity}, Used=${ticket.used_count}, UsedAt=${ticket.used_at}`);

        // Handle legacy usage logic
        let currentUsed = ticket.used_count || 0;
        if (currentUsed === 0 && ticket.used_at !== null) {
            currentUsed = ticket.quantity;
            console.log('⚠️ Legacy ticket detected. Treating as fully used.');
        }

        const total = ticket.quantity;
        const remaining = total - currentUsed;

        if (checkInCount > remaining) {
            await client.query('ROLLBACK');
            console.warn(`⚠️ Check-in denied: Requested ${checkInCount} but only ${remaining} remaining.`);
            return res.json({ success: false, message: `Cannot check in ${checkInCount}. Only ${remaining} remaining.` });
        }

        const newUsedCount = currentUsed + checkInCount;

        // Update used_count
        let updateQuery = 'UPDATE tickets SET used_count = $1';
        const params = [newUsedCount];

        // If fully used, set timestamp
        if (newUsedCount >= total) {
            updateQuery += ', used_at = NOW()';
            console.log(`🎉 Ticket fully redeemed! Setting used_at timestamp.`);
        }

        updateQuery += ' WHERE id = $2 RETURNING used_count, used_at';
        params.push(ticket_id);

        const updateResult = await client.query(updateQuery, params);
        await client.query('COMMIT');

        const updatedRow = updateResult.rows[0];
        console.log(`✅ Check-in successful: Ticket ${ticket_id} - New State: Used=${updatedRow.used_count}/${total}, UsedAt=${updatedRow.used_at}`);

        // Emit Real-time Update
        const io = req.app.get('io');
        if (io) {
            io.emit('ticket_updated', {
                ticket_id: ticket_id,
                remaining: total - newUsedCount,
                used_count: newUsedCount,
                total: total,
                action: 'check-in',
                count: checkInCount
            });
        }

        return res.json({
            success: true,
            message: `Successfully checked in ${checkInCount} person(s)`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ CHECK-IN SERVER ERROR:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /validate/:code - Quick validation check (GET method)
 */
router.get('/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const result = await db.query(`
            SELECT t.*, m.team_home, m.team_away, m.match_date
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            WHERE t.qr_code = $1
        `, [code]);

        if (result.rows.length === 0) {
            return res.json({
                exists: false,
                message: 'Ticket not found'
            });
        }

        const ticket = result.rows[0];

        return res.json({
            exists: true,
            status: ticket.status,
            used: ticket.used_at !== null,
            usedAt: ticket.used_at,
            match: `${ticket.team_home} vs ${ticket.team_away}`,
            matchDate: ticket.match_date
        });

    } catch (error) {
        console.error('❌ Quick validate error:', error);
        return res.json({
            exists: false,
            error: 'Validation failed'
        });
    }
});

module.exports = router;
