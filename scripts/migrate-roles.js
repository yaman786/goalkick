const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL and individual DB_* environment variables
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'goalkick',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    };

const pool = new Pool(poolConfig);

async function migrate() {
    try {
        console.log('🔄 Starting migration: Add roles to admins table...');

        // Check if column exists
        const checkResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='admins' AND column_name='role'
        `);

        if (checkResult.rows.length === 0) {
            console.log('📝 Adding role column...');
            await pool.query(`
                ALTER TABLE admins 
                ADD COLUMN role VARCHAR(20) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'staff'));
            `);
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Role column already exists.');
        }

        // Backfill nulls if any (though NOT NULL constraint prevents this, good for safety if constraint wasn't added)
        // Also ensure existing admins have 'admin' role if somehow they don't
        const updateResult = await pool.query(`
            UPDATE admins SET role = 'admin' WHERE role IS NULL OR role = '';
        `);

        if (updateResult.rowCount > 0) {
            console.log(`✅ Updated ${updateResult.rowCount} existing admins to 'admin' role.`);
        }

        console.log('✅ Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
