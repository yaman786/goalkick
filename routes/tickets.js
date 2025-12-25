/**
 * GoalKick Lite - Ticket Routes
 * Ticket purchase and reservation
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getPaymentDetails } = require('../utils/esewaHelper');

// eSewa configuration
const ESEWA_MODE = process.env.ESEWA_MODE || 'manual';
const ESEWA_PERSONAL_ID = process.env.ESEWA_PERSONAL_ID || '9821446561';

/**
 * POST /buy_ticket - Create ticket reservation and redirect to payment
 */
router.post('/buy_ticket', async (req, res) => {
    const client = await db.getClient();

    try {
        const { match_id, quantity = 1, phone, name } = req.body;

        // Validate required fields
        if (!match_id) {
            return res.status(400).render('error', {
                title: 'Invalid Request',
                message: 'Please select a match to purchase tickets.',
                errorCode: 400
            });
        }

        if (!phone || !name) {
            return res.status(400).render('error', {
                title: 'Invalid Request',
                message: 'Please provide your name and phone number.',
                errorCode: 400
            });
        }

        const ticketQuantity = parseInt(quantity) || 1;

        if (ticketQuantity < 1 || ticketQuantity > 10) {
            return res.status(400).render('error', {
                title: 'Invalid Quantity',
                message: 'You can purchase between 1 and 10 tickets at a time.',
                errorCode: 400
            });
        }

        // Start transaction
        await client.query('BEGIN');

        // Check match availability with row lock
        const matchResult = await client.query(`
            SELECT id, team_home, team_away, price, available_seats, match_date, venue
            FROM matches
            WHERE id = $1 AND is_active = true
            FOR UPDATE
        `, [match_id]);

        if (matchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).render('error', {
                title: 'Match Not Found',
                message: 'This match is not available for booking.',
                errorCode: 404
            });
        }

        const match = matchResult.rows[0];

        // Check if enough seats available
        if (match.available_seats < ticketQuantity) {
            await client.query('ROLLBACK');
            return res.status(400).render('error', {
                title: 'Not Enough Seats',
                message: `Only ${match.available_seats} seats are available.`,
                errorCode: 400
            });
        }

        // Calculate total amount
        const totalAmount = parseFloat(match.price) * ticketQuantity;

        // Create or get user
        let userId;
        const existingUser = await client.query(
            'SELECT id FROM users WHERE phone = $1',
            [phone]
        );

        if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            await client.query(
                'UPDATE users SET name = $1 WHERE id = $2',
                [name, userId]
            );
        } else {
            const newUser = await client.query(
                'INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id',
                [phone, name]
            );
            userId = newUser.rows[0].id;
        }

        // Generate booking code (short reference for user)
        const bookingCode = 'BK-' + Date.now().toString(36).toUpperCase();

        // Create ticket with PENDING status
        const ticketResult = await client.query(`
            INSERT INTO tickets (user_id, match_id, quantity, total_amount, status, qr_code)
            VALUES ($1, $2, $3, $4, 'PENDING', $5)
            RETURNING id
        `, [userId, match_id, ticketQuantity, totalAmount, bookingCode]);

        const ticketId = ticketResult.rows[0].id;

        // Reserve seats (reduce available count)
        await client.query(`
            UPDATE matches
            SET available_seats = available_seats - $1
            WHERE id = $2
        `, [ticketQuantity, match_id]);

        // Create initial payment record
        await client.query(`
            INSERT INTO payments (ticket_id, amount, status)
            VALUES ($1, $2, 'PENDING')
        `, [ticketId, totalAmount]);

        // Commit transaction
        await client.query('COMMIT');

        console.log(`✅ Ticket reserved: ${bookingCode} for Rs. ${totalAmount}`);

        // Check payment mode
        if (ESEWA_MODE === 'manual') {
            // Manual payment - show payment instructions
            res.render('payment_instructions', {
                title: 'Complete Payment',
                match,
                ticket: {
                    id: ticketId,
                    bookingCode,
                    quantity: ticketQuantity,
                    totalAmount
                },
                esewaId: ESEWA_PERSONAL_ID,
                customerName: name,
                customerPhone: phone
            });
        } else {
            // Merchant API mode - redirect to eSewa
            const paymentDetails = getPaymentDetails({
                amount: totalAmount,
                productId: ticketId
            });

            res.render('esewa_redirect', {
                title: 'Redirecting to eSewa...',
                paymentUrl: paymentDetails.url,
                formData: paymentDetails.formData,
                match,
                totalAmount,
                quantity: ticketQuantity
            });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ticket purchase error:', error);
        res.status(500).render('error', {
            title: 'Purchase Failed',
            message: 'Could not process your ticket purchase. Please try again.',
            errorCode: 500
        });
    } finally {
        client.release();
    }
});

/**
 * POST /confirm_payment - User submits eSewa transaction ID
 */
router.post('/confirm_payment', async (req, res) => {
    try {
        const { ticket_id, esewa_ref } = req.body;

        if (!ticket_id || !esewa_ref) {
            return res.status(400).render('error', {
                title: 'Invalid Request',
                message: 'Please provide the transaction ID.',
                errorCode: 400
            });
        }

        // Update payment with eSewa reference
        const updateResult = await db.query(`
            UPDATE payments SET esewa_ref = $1, status = 'AWAITING_VERIFICATION'
            WHERE ticket_id = $2
        `, [esewa_ref.trim(), ticket_id]);

        console.log(`📝 Payment Update Result: ${updateResult.rowCount} rows affected for Ticket ${ticket_id}, Ref: ${esewa_ref}`);

        // Get ticket info for confirmation
        const ticketResult = await db.query(`
            SELECT t.qr_code FROM tickets t WHERE t.id = $1
        `, [ticket_id]);

        const bookingCode = ticketResult.rows[0]?.qr_code || '';

        console.log(`📝 Payment submitted for verification: ${bookingCode}, eSewa ref: ${esewa_ref}`);

        // Redirect to home with success message
        res.redirect(`/?payment=success&ref=${encodeURIComponent(esewa_ref.trim())}`);

        // ============================================
        // REAL-TIME NOTIFICATION (SOCKET.IO)
        // ============================================
        try {
            const io = req.app.get('io');
            if (io) {
                // Fetch match details for the notification
                const matchResult = await db.query(`
                    SELECT m.team_home, m.team_away, m.venue, t.quantity, t.total_amount
                    FROM tickets t
                    JOIN matches m ON t.match_id = m.id
                    WHERE t.id = $1
                `, [ticket_id]);

                if (matchResult.rows.length > 0) {
                    const info = matchResult.rows[0];
                    io.to('admin_notifications').emit('ticket_sold', {
                        amount: info.total_amount,
                        count: info.quantity,
                        match: `${info.team_home} vs ${info.team_away}`,
                        buyer: 'Manual Verification',
                        timestamp: new Date()
                    });
                    console.log('📡 Emitted ticket_sold event (Manual)');
                }
            }
        } catch (socketError) {
            console.error('⚠️ Socket emission failed:', socketError);
        }

    } catch (error) {
        console.error('❌ Payment confirmation error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Could not submit payment details. Please try again.',
            errorCode: 500
        });
    }
});

/**
 * GET /confirm_payment - Catch GET requests to prevent 404
 */
router.get('/confirm_payment', (req, res) => {
    res.redirect('/');
});

module.exports = router;

