/**
 * GoalKick Lite - Main Server
 * Lightweight Football Ticketing System for Nepal
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Import routes
const indexRoutes = require('./routes/index');
const ticketRoutes = require('./routes/tickets');
const paymentRoutes = require('./routes/payment');
const gatekeeperRoutes = require('./routes/gatekeeper');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Trust proxy (required for secure cookies on Render/Heroku)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Parse URL-encoded bodies (for form submissions)
app.use(bodyParser.urlencoded({ extended: true }));

// Parse JSON bodies (for API requests)
app.use(bodyParser.json());

// Session middleware (for admin authentication)
app.use(session({
    secret: process.env.SESSION_SECRET || 'goalkick-lite-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ROUTES
// ============================================

// Admin panel (must be before other routes)
app.use('/admin', adminRoutes);

// Home and match listing
app.use('/', indexRoutes);

// Ticket purchase
app.use('/', ticketRoutes);

// Payment callbacks
app.use('/', paymentRoutes);

// Gatekeeper/Scanner
app.use('/', gatekeeperRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        errorCode: 404
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong. Please try again later.',
        errorCode: 500
    });
});

// ============================================
// SERVER STARTUP
// ============================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚽  GoalKick Lite - Football Ticketing System  ⚽       ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                          ║
║                                                           ║
║   Endpoints:                                              ║
║   • Home:          GET  /                                 ║
║   • Buy Ticket:    POST /buy_ticket                       ║
║   • Payment:       GET  /payment_success                  ║
║   • Gatekeeper:    GET  /gatekeeper                       ║
║   • Admin:         GET  /admin                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
