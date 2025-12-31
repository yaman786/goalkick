/**
 * Migration Script: Add used_count column to tickets table
 * This script is safe to run multiple times - it only adds the column if it doesn't exist
 * 
 * Run on production: node scripts/add_used_count.js
 */

const db = require('../config/database');

async function addUsedCountColumn() {
    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        console.log('🔄 Checking/Adding used_count column...');

        // Check if column exists first
        const checkColumn = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tickets' AND column_name = 'used_count';
        `);

        if (checkColumn.rows.length === 0) {
            console.log('📦 Column does not exist, creating...');

            // Add column
            await client.query(`
                ALTER TABLE tickets 
                ADD COLUMN used_count INTEGER DEFAULT 0;
            `);
            console.log('✅ Column added successfully');
        } else {
            console.log('ℹ️  Column already exists, skipping creation');
        }

        // Initialize used_count based on current status
        // If ticket is already 'used' (used_at is not null), set used_count = quantity
        const updateResult = await client.query(`
            UPDATE tickets 
            SET used_count = quantity 
            WHERE used_at IS NOT NULL AND (used_count IS NULL OR used_count = 0)
            RETURNING id;
        `);

        if (updateResult.rows.length > 0) {
            console.log(`📝 Updated ${updateResult.rows.length} legacy tickets with used_count = quantity`);
        }

        // Ensure no NULL values
        await client.query(`
            UPDATE tickets SET used_count = 0 WHERE used_count IS NULL;
        `);

        await client.query('COMMIT');
        console.log('✅ Migration successful: used_count column ready.');

    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('⚠️ Rollback failed:', rollbackError.message);
            }
        }

        // Check for specific error types
        if (error.code === '42701') {
            // Column already exists error
            console.log('ℹ️  Column already exists (42701), continuing...');
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            console.error('❌ Database connection failed. Check DATABASE_URL or DB_* environment variables.');
            console.error('   Error:', error.message);
        } else {
            console.error('❌ Migration failed:', error.message);
            console.error('   Error code:', error.code);
        }
        if (client) {
            try {
                client.release();
            } catch (e) {
                // Ignore release errors
            }
        }

        // Only exit if run directly
        if (require.main === module) {
            process.exit(0);
        }
    }
}

// Run if called directly
if (require.main === module) {
    addUsedCountColumn();
}

module.exports = addUsedCountColumn;
