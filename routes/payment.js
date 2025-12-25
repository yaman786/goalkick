/**
 * GoalKick Lite - Payment Routes
 * eSewa payment callbacks and verification
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyPayment, parseCallback } = require('../utils/esewaHelper');
const { generateTicketQR } = require('../utils/qrGenerator');

/**
 * GET /payment_success - eSewa success callback
 * 
 * CRITICAL: This route performs Server-to-Server (SEP) verification
 * to confirm the payment was actually received by eSewa.
 * NEVER trust URL parameters alone!
 */
router.get('/payment_success', async (req, res) => {
    const client = await db.getClient();

    try {
        // Parse callback parameters
        const callbackData = parseCallback(req.query);
        console.log('📥 Payment callback received:', callbackData);

        const { orderId, amount, referenceId } = callbackData;

        // Validate required parameters
        if (!orderId || !referenceId) {
            console.error('❌ Missing payment callback parameters');
            return res.render('error', {
                title: 'Payment Error',
                message: 'Invalid payment callback. Missing required parameters.',
                errorCode: 400
            });
        }

        // Start transaction
        await client.query('BEGIN');

        // Fetch ticket with lock
        const ticketResult = await client.query(`
            SELECT t.*, m.team_home, m.team_away, m.match_date, m.venue, m.price,
                   u.name as user_name, u.phone as user_phone
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
            FOR UPDATE
        `, [orderId]);

        if (ticketResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error('❌ Ticket not found:', orderId);
            return res.render('error', {
                title: 'Ticket Not Found',
                message: 'The ticket for this payment was not found.',
                errorCode: 404
            });
        }

        const ticket = ticketResult.rows[0];

        // Check if ticket was already processed
        if (ticket.status === 'PAID') {
            await client.query('ROLLBACK');

            // Ticket already paid - show the existing ticket
            const qrDataURL = await require('../utils/qrGenerator').generateQRDataURL(ticket.qr_code);

            return res.render('ticket', {
                title: 'Your Ticket',
                ticket,
                qrCode: qrDataURL,
                alreadyPaid: true
            });
        }

        // ============================================
        // CRITICAL: SERVER-TO-SERVER VERIFICATION
        // ============================================
        console.log('🔐 Starting SEP verification...');

        const verification = await verifyPayment({
            amount: amount,
            referenceId: referenceId,
            productId: orderId
        });

        console.log('📋 Verification result:', verification);

        if (!verification.verified) {
            // Payment verification failed
            await client.query(`
                UPDATE tickets SET status = 'FAILED' WHERE id = $1
            `, [orderId]);

            await client.query(`
                UPDATE payments 
                SET status = 'FAILED', 
                    esewa_ref = $1,
                    verification_response = $2
                WHERE ticket_id = $3
            `, [referenceId, JSON.stringify(verification), orderId]);

            // Release reserved seats
            await client.query(`
                UPDATE matches
                SET available_seats = available_seats + $1
                WHERE id = $2
            `, [ticket.quantity, ticket.match_id]);

            await client.query('COMMIT');

            console.error('❌ Payment verification failed:', verification.error);
            return res.render('error', {
                title: 'Payment Verification Failed',
                message: 'Could not verify your payment with eSewa. If money was deducted, it will be refunded within 24 hours.',
                errorCode: 402
            });
        }

        // ============================================
        // PAYMENT VERIFIED - GENERATE TICKET
        // ============================================

        // Generate unique QR code
        const qrResult = await generateTicketQR(orderId);

        // Update ticket to PAID with QR code
        await client.query(`
            UPDATE tickets 
            SET status = 'PAID', qr_code = $1
            WHERE id = $2
        `, [qrResult.code, orderId]);

        // Update payment record
        await client.query(`
            UPDATE payments 
            SET status = 'SUCCESS', 
                esewa_ref = $1,
                verification_response = $2
            WHERE ticket_id = $3
        `, [referenceId, JSON.stringify(verification), orderId]);

        await client.query('COMMIT');

        console.log(`✅ Payment verified and ticket generated: ${qrResult.code}`);

        // Render success page with ticket
        res.render('ticket', {
            title: 'Ticket Confirmed!',
            ticket: {
                ...ticket,
                qr_code: qrResult.code,
                status: 'PAID'
            },
            qrCode: qrResult.qrDataURL,
            referenceId,
            alreadyPaid: false
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Payment success handler error:', error);
        res.render('error', {
            title: 'Processing Error',
            message: 'An error occurred while processing your payment. Please contact support.',
            errorCode: 500
        });
    } finally {
        client.release();
    }
});

/**
 * GET /payment_failure - eSewa failure callback
 */
router.get('/payment_failure', async (req, res) => {
    try {
        const { pid } = req.query;

        if (pid) {
            // Update ticket status to FAILED and release seats
            const ticketResult = await db.query(
                'SELECT * FROM tickets WHERE id = $1',
                [pid]
            );

            if (ticketResult.rows.length > 0) {
                const ticket = ticketResult.rows[0];

                await db.query(
                    'UPDATE tickets SET status = $1 WHERE id = $2',
                    ['FAILED', pid]
                );

                await db.query(
                    'UPDATE payments SET status = $1 WHERE ticket_id = $2',
                    ['FAILED', pid]
                );

                // Release reserved seats
                await db.query(`
                    UPDATE matches
                    SET available_seats = available_seats + $1
                    WHERE id = $2
                `, [ticket.quantity, ticket.match_id]);
            }
        }

        res.render('error', {
            title: 'Payment Cancelled',
            message: 'Your payment was cancelled or failed. No charges have been made.',
            errorCode: 402,
            showRetry: true
        });

    } catch (error) {
        console.error('❌ Payment failure handler error:', error);
        res.render('error', {
            title: 'Error',
            message: 'An error occurred. Please try again.',
            errorCode: 500
        });
    }
});

/**
 * GET /ticket/:code - View ticket by QR code
 */
router.get('/ticket/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const result = await db.query(`
            SELECT t.*, m.team_home, m.team_away, m.match_date, m.venue, m.price,
                   u.name as user_name, u.phone as user_phone
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.qr_code = $1
        `, [code]);

        if (result.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Ticket Not Found',
                message: 'This ticket code is invalid.',
                errorCode: 404
            });
        }

        const ticket = result.rows[0];
        const qrDataURL = await require('../utils/qrGenerator').generateQRDataURL(ticket.qr_code);

        res.render('ticket', {
            title: 'Your Ticket',
            ticket,
            qrCode: qrDataURL,
            alreadyPaid: true
        });

    } catch (error) {
        console.error('❌ View ticket error:', error);
        res.render('error', {
            title: 'Error',
            message: 'Could not retrieve ticket.',
            errorCode: 500
        });
    }
});

module.exports = router;
