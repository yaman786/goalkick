/**
 * GoalKick Lite - Gatekeeper Routes
 * QR code scanning and ticket validation
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

        const ticket = result.rows[0];

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

        // Check if ticket was already used
        if (ticket.used_at !== null) {
            await client.query('ROLLBACK');
            const usedTime = new Date(ticket.used_at).toLocaleString('en-NP');
            console.log(`🚫 Already used ticket: ${cleanCode} at ${usedTime}`);
            return res.json({
                valid: false,
                status: 'ALREADY_USED',
                message: `Ticket already used at ${usedTime}`,
                ticket: {
                    code: cleanCode,
                    match: `${ticket.team_home} vs ${ticket.team_away}`,
                    usedAt: ticket.used_at
                }
            });
        }

        // ============================================
        // TICKET IS VALID - MARK AS USED
        // ============================================

        await client.query(`
            UPDATE tickets 
            SET used_at = NOW()
            WHERE id = $1
        `, [ticket.id]);

        await client.query('COMMIT');

        console.log(`✅ Ticket validated: ${cleanCode} - ENTER`);

        return res.json({
            valid: true,
            status: 'ENTER',
            message: 'Welcome! Enjoy the match!',
            ticket: {
                code: cleanCode,
                match: `${ticket.team_home} vs ${ticket.team_away}`,
                matchDate: ticket.match_date,
                venue: ticket.venue,
                quantity: ticket.quantity,
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
