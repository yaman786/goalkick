
router.post('/test-alert', (req, res) => {
    const io = req.app.get('io');
    if(io) {
        io.to('admin_notifications').emit('ticket_sold', {
            amount: 500,
            count: 1,
            match: 'Test Team A vs Test Team B',
            timestamp: new Date()
        });
    }
    res.json({ success: true });
});
