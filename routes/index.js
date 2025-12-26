/**
 * GoalKick Lite - Index Routes
 * Home page and match listing
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET / - Home page with match listings
 */
router.get('/', async (req, res) => {
    try {
        // Fetch all active matches with available seats
        const result = await db.query(`
            SELECT 
                id,
                team_home,
                team_away,
                match_date,
                venue,
                price,
                total_seats,
                available_seats,
                is_active
            FROM matches
            WHERE is_active = true
            AND match_date > NOW()
            ORDER BY match_date ASC
        `);

        const matches = result.rows;

        res.render('index', {
            title: 'GoalKick Lite - Football Tickets',
            matches,
            formatDate: (date) => {
                return new Date(date).toLocaleDateString('en-NP', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },
            formatPrice: (price) => {
                return `Rs. ${parseFloat(price).toLocaleString('en-NP')}`;
            },
            query: req.query
        });

    } catch (error) {
        console.error('❌ Error fetching matches:', error);
        res.render('error', {
            title: 'Error',
            message: 'Could not load matches. Please try again later.',
            errorCode: 500
        });
    }
});

/**
 * GET /match/:id - Single match details
 */
router.get('/match/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT * FROM matches WHERE id = $1 AND is_active = true
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).render('error', {
                title: 'Match Not Found',
                message: 'This match does not exist or is no longer available.',
                errorCode: 404
            });
        }

        const match = result.rows[0];

        res.render('checkout', {
            title: `${match.team_home} vs ${match.team_away}`,
            match,
            formatDate: (date) => {
                return new Date(date).toLocaleDateString('en-NP', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },
            formatPrice: (price) => {
                return `Rs. ${parseFloat(price).toLocaleString('en-NP')}`;
            }
        });

    } catch (error) {
        console.error('❌ Error fetching match:', error);
        res.render('error', {
            title: 'Error',
            message: 'Could not load match details.',
            errorCode: 500
        });
    }
});

/**
 * GET /find-ticket - Ticket lookup page
 */
router.get('/find-ticket', (req, res) => {
    res.render('find-ticket', {
        title: 'Find Your Ticket',
        ticket: null,
        esewaRef: req.query.ref || '',
        error: null,
        searched: false
    });
});

/**
 * POST /find-ticket - Search tickets by eSewa Transaction ID
 */
router.post('/find-ticket', async (req, res) => {
    try {
        const { esewa_ref } = req.body;

        if (!esewa_ref || esewa_ref.trim().length < 3) {
            return res.render('find-ticket', {
                title: 'Find Your Ticket',
                ticket: null,
                esewaRef: esewa_ref,
                error: 'Please enter a valid eSewa transaction ID',
                searched: false
            });
        }

        // Find ticket by eSewa transaction reference
        const ticketResult = await db.query(`
            SELECT t.*, m.team_home, m.team_away, m.match_date, m.venue,
                   u.name as user_name, u.phone as user_phone,
                   p.esewa_ref, p.status as payment_status
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            LEFT JOIN users u ON t.user_id = u.id
            JOIN payments p ON t.id = p.ticket_id
            WHERE p.esewa_ref = $1
            ORDER BY t.created_at DESC
            LIMIT 1
        `, [esewa_ref.trim()]);

        if (ticketResult.rows.length === 0) {
            return res.render('find-ticket', {
                title: 'Find Your Ticket',
                ticket: null,
                esewaRef: esewa_ref,
                error: null,
                searched: true
            });
        }

        res.render('find-ticket', {
            title: 'Find Your Ticket',
            ticket: ticketResult.rows[0],
            esewaRef: esewa_ref,
            error: null,
            searched: true
        });

    } catch (error) {
        console.error('❌ Ticket lookup error:', error);
        res.render('find-ticket', {
            title: 'Find Your Ticket',
            ticket: null,
            esewaRef: req.body.esewa_ref || '',
            error: 'Something went wrong. Please try again.',
            searched: false
        });
    }
});

module.exports = router;
