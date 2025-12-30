const { pool } = require('../config/database');

async function migrate() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('🔍 Checking if branding column exists...');
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='matches' AND column_name='branding';
        `);

        if (checkRes.rows.length === 0) {
            console.log('🚧 Column not found. Adding "branding" (JSONB) column...');
            await client.query(`ALTER TABLE matches ADD COLUMN branding JSONB DEFAULT '{}';`);
            console.log('✅ Column "branding" added successfully.');
        } else {
            console.log('ℹ️ Column "branding" already exists. Skipping.');
        }

        client.release();
    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
