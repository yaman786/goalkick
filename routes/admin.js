/**
 * GoalKick Lite - Admin Routes
 * Dashboard, match management, ticket management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAdmin, redirectIfAuthenticated, attachAdminToLocals } = require('../middleware/adminAuth');

// Attach admin info to all admin routes
router.use(attachAdminToLocals);

// ============================================
// AUTH ROUTES
// ============================================

/**
 * GET /admin/login - Login page
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('admin/login', {
        title: 'Admin Login',
        error: req.query.error || null
    });
});

/**
 * POST /admin/login - Process login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.redirect('/admin/login?error=Please enter username and password');
        }

        // Find admin
        const result = await db.query(
            'SELECT * FROM admins WHERE username = $1',
            [username.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.redirect('/admin/login?error=Invalid credentials');
        }

        const admin = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.redirect('/admin/login?error=Invalid credentials');
        }

        // Set session
        req.session.adminId = admin.id;
        req.session.admin = {
            id: admin.id,
            username: admin.username,
            name: admin.name
        };

        console.log(`✅ Admin logged in: ${admin.username}`);

        // Redirect to intended destination or dashboard
        const returnTo = req.session.returnTo || '/admin';
        delete req.session.returnTo;
        res.redirect(returnTo);

    } catch (error) {
        console.error('❌ Login error:', error);
        res.redirect('/admin/login?error=Login failed');
    }
});

/**
 * GET /admin/logout - Logout
 */
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        res.redirect('/admin/login');
    });
});

// ============================================
// PROTECTED ROUTES (require admin auth)
// ============================================
router.use(requireAdmin);

/**
 * GET /admin - Dashboard
 */
router.get('/', async (req, res) => {
    try {
        // Get stats
        const stats = await getAdminStats();
        const recentTickets = await getRecentTickets(10);
        const upcomingMatches = await getUpcomingMatches(5);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            recentTickets,
            upcomingMatches
        });
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: { revenue: 0, ticketsSold: 0, matchesCount: 0, usersCount: 0 },
            recentTickets: [],
            upcomingMatches: [],
            error: 'Failed to load dashboard data'
        });
    }
});

// ============================================
// MATCH MANAGEMENT
// ============================================

/**
 * GET /admin/matches - List all matches
 */
router.get('/matches', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, 
                   COUNT(t.id) FILTER (WHERE t.status = 'PAID') as tickets_sold,
                   COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'PAID'), 0) as revenue
            FROM matches m
            LEFT JOIN tickets t ON m.id = t.match_id
            GROUP BY m.id
            ORDER BY m.match_date DESC
        `);

        res.render('admin/matches', {
            title: 'Manage Matches',
            matches: result.rows
        });
    } catch (error) {
        console.error('❌ Matches list error:', error);
        res.render('admin/matches', {
            title: 'Manage Matches',
            matches: [],
            error: 'Failed to load matches'
        });
    }
});

/**
 * GET /admin/matches/new - New match form
 */
router.get('/matches/new', (req, res) => {
    res.render('admin/match-form', {
        title: 'Create Match',
        match: null,
        isEdit: false
    });
});

/**
 * POST /admin/matches - Create match
 */
router.post('/matches', async (req, res) => {
    try {
        const { team_home, team_away, match_date, venue, price, total_seats } = req.body;

        await db.query(`
            INSERT INTO matches (team_home, team_away, match_date, venue, price, total_seats, available_seats)
            VALUES ($1, $2, $3, $4, $5, $6, $6)
        `, [team_home, team_away, match_date, venue, price, total_seats]);

        console.log(`✅ Match created: ${team_home} vs ${team_away}`);
        res.redirect('/admin/matches?success=Match created');
    } catch (error) {
        console.error('❌ Create match error:', error);
        res.redirect('/admin/matches/new?error=Failed to create match');
    }
});

/**
 * GET /admin/matches/:id/edit - Edit match form
 */
router.get('/matches/:id/edit', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.redirect('/admin/matches?error=Match not found');
        }

        res.render('admin/match-form', {
            title: 'Edit Match',
            match: result.rows[0],
            isEdit: true
        });
    } catch (error) {
        console.error('❌ Edit match error:', error);
        res.redirect('/admin/matches?error=Failed to load match');
    }
});

/**
 * POST /admin/matches/:id - Update match
 */
router.post('/matches/:id', async (req, res) => {
    try {
        const { team_home, team_away, match_date, venue, price, total_seats, is_active } = req.body;

        await db.query(`
            UPDATE matches SET
                team_home = $1,
                team_away = $2,
                match_date = $3,
                venue = $4,
                price = $5,
                total_seats = $6,
                is_active = $7
            WHERE id = $8
        `, [team_home, team_away, match_date, venue, price, total_seats, is_active === 'on', req.params.id]);

        console.log(`✅ Match updated: ${team_home} vs ${team_away}`);
        res.redirect('/admin/matches?success=Match updated');
    } catch (error) {
        console.error('❌ Update match error:', error);
        res.redirect(`/admin/matches/${req.params.id}/edit?error=Failed to update match`);
    }
});

/**
 * POST /admin/matches/:id/toggle - Toggle match active status
 */
router.post('/matches/:id/toggle', async (req, res) => {
    try {
        await db.query(`
            UPDATE matches SET is_active = NOT is_active WHERE id = $1
        `, [req.params.id]);

        res.redirect('/admin/matches');
    } catch (error) {
        console.error('❌ Toggle match error:', error);
        res.redirect('/admin/matches?error=Failed to toggle match');
    }
});

// ============================================
// TICKET MANAGEMENT
// ============================================

/**
 * GET /admin/tickets - List tickets with search/filter
 */
router.get('/tickets', async (req, res) => {
    try {
        const { search, status, match_id } = req.query;
        let query = `
            SELECT t.*, m.team_home, m.team_away, m.match_date, m.venue,
                   u.name as user_name, u.phone as user_phone,
                   p.esewa_ref as esewa_transaction_id
            FROM tickets t
            JOIN matches m ON t.match_id = m.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN payments p ON t.id = p.ticket_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (t.qr_code ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status) {
            query += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (match_id) {
            query += ` AND t.match_id = $${paramIndex}`;
            params.push(match_id);
            paramIndex++;
        }

        query += ' ORDER BY t.created_at DESC LIMIT 100';

        const [ticketsResult, matchesResult] = await Promise.all([
            db.query(query, params),
            db.query('SELECT id, team_home, team_away FROM matches ORDER BY match_date DESC')
        ]);

        res.render('admin/tickets', {
            title: 'Manage Tickets',
            tickets: ticketsResult.rows,
            matches: matchesResult.rows,
            filters: { search, status, match_id }
        });
    } catch (error) {
        console.error('❌ Tickets list error:', error);
        res.render('admin/tickets', {
            title: 'Manage Tickets',
            tickets: [],
            matches: [],
            filters: {},
            error: 'Failed to load tickets'
        });
    }
});

/**
 * POST /admin/tickets/:id/mark-used - Manually mark ticket as used
 */
router.post('/tickets/:id/mark-used', async (req, res) => {
    try {
        await db.query(`
            UPDATE tickets SET used_at = NOW() WHERE id = $1 AND used_at IS NULL
        `, [req.params.id]);

        res.redirect('/admin/tickets?success=Ticket marked as used');
    } catch (error) {
        console.error('❌ Mark used error:', error);
        res.redirect('/admin/tickets?error=Failed to mark ticket');
    }
});

/**
 * POST /admin/tickets/:id/approve - Approve payment and generate QR
 */
router.post('/tickets/:id/approve', async (req, res) => {
    try {
        const ticketId = req.params.id;

        // Generate proper QR code
        const qrCode = 'NEP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

        // Update ticket to PAID status with QR code
        await db.query(`
            UPDATE tickets SET status = 'PAID', qr_code = $1 WHERE id = $2
        `, [qrCode, ticketId]);

        // Update payment status
        await db.query(`
            UPDATE payments SET status = 'COMPLETED' WHERE ticket_id = $1
        `, [ticketId]);

        console.log(`✅ Payment approved for ticket ${ticketId}, QR: ${qrCode}`);
        res.redirect('/admin/tickets?success=Payment approved, ticket issued');
    } catch (error) {
        console.error('❌ Approve payment error:', error);
        res.redirect('/admin/tickets?error=Failed to approve payment');
    }
});

/**
 * POST /admin/tickets/:id/reject - Reject payment and restore seats
 */
router.post('/tickets/:id/reject', async (req, res) => {
    try {
        const ticketId = req.params.id;

        // Get ticket details to restore seats
        const ticketResult = await db.query(
            'SELECT match_id, quantity FROM tickets WHERE id = $1',
            [ticketId]
        );

        if (ticketResult.rows.length > 0) {
            const { match_id, quantity } = ticketResult.rows[0];

            // Restore seats
            await db.query(`
                UPDATE matches SET available_seats = available_seats + $1 WHERE id = $2
            `, [quantity, match_id]);
        }

        // Update ticket status
        await db.query(`
            UPDATE tickets SET status = 'REJECTED' WHERE id = $1
        `, [ticketId]);

        // Update payment status
        await db.query(`
            UPDATE payments SET status = 'REJECTED' WHERE ticket_id = $1
        `, [ticketId]);

        console.log(`❌ Payment rejected for ticket ${ticketId}`);
        res.redirect('/admin/tickets?success=Payment rejected, seats restored');
    } catch (error) {
        console.error('❌ Reject payment error:', error);
        res.redirect('/admin/tickets?error=Failed to reject payment');
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAdminStats() {
    const result = await db.query(`
        SELECT
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0) as total_revenue,
            COUNT(*) FILTER (WHERE status = 'PAID') as tickets_sold,
            (SELECT COUNT(*) FROM matches WHERE is_active = true) as active_matches,
            (SELECT COUNT(*) FROM users) as total_users,
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID' AND created_at >= CURRENT_DATE), 0) as today_revenue,
            COUNT(*) FILTER (WHERE status = 'PAID' AND created_at >= CURRENT_DATE) as today_tickets
        FROM tickets
    `);
    return result.rows[0];
}

async function getRecentTickets(limit) {
    const result = await db.query(`
        SELECT t.*, m.team_home, m.team_away, u.name as user_name, u.phone as user_phone
        FROM tickets t
        JOIN matches m ON t.match_id = m.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.status = 'PAID'
        ORDER BY t.created_at DESC
        LIMIT $1
    `, [limit]);
    return result.rows;
}

async function getUpcomingMatches(limit) {
    const result = await db.query(`
        SELECT m.*, 
               COUNT(t.id) FILTER (WHERE t.status = 'PAID') as tickets_sold
        FROM matches m
        LEFT JOIN tickets t ON m.id = t.match_id
        WHERE m.match_date >= CURRENT_DATE AND m.is_active = true
        GROUP BY m.id
        ORDER BY m.match_date ASC
        LIMIT $1
    `, [limit]);
    return result.rows;
}

module.exports = router;
