/**
 * Migration: Add role column to admins table
 * Run this once on production to fix staff management
 */
const db = require('../config/database');

async function migrate() {
    console.log('🔧 Running migration: Add role column to admins table...');

    try {
        await db.query(`
            ALTER TABLE admins 
            ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin'
        `);
        console.log('✅ Migration successful! Role column added.');

        // Verify
        const result = await db.query('SELECT id, username, role FROM admins');
        console.log('📋 Current admins:', result.rows);

    } catch (error) {
        if (error.code === '42701') {
            console.log('ℹ️ Column already exists, skipping.');
        } else {
            console.error('❌ Migration failed:', error.message);
        }
    } finally {
        await db.pool.end();
    }
}

migrate();
