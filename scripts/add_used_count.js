const db = require('../config/database');

async function addUsedCountColumn() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        console.log('🔄 Adding used_count column...');

        // Add column if it doesn't exist
        await client.query(`
            ALTER TABLE tickets 
            ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
        `);

        // Initialize used_count based on current status
        // If ticket is already 'used' (used_at is not null), set used_count = quantity
        await client.query(`
            UPDATE tickets 
            SET used_count = quantity 
            WHERE used_at IS NOT NULL AND used_count = 0;
        `);

        await client.query('COMMIT');
        console.log('✅ Migration successful: used_count column added and initialized.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addUsedCountColumn();
