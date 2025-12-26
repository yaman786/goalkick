const db = require('../config/database');

async function migrateStatusLength() {
    console.log('🔄 Starting migration to increase payments.status length...');

    try {
        // Check current length
        const res = await db.query(`
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'payments' AND column_name = 'status';
        `);
        console.log(`📊 Current Status Length: ${res.rows[0]?.character_maximum_length}`);

        // Alter table
        console.log('🛠 Altering column type to VARCHAR(50)...');
        await db.query(`ALTER TABLE payments ALTER COLUMN status TYPE VARCHAR(50);`);
        console.log('✅ Column altered successfully!');

        // Verify
        const verify = await db.query(`
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'payments' AND column_name = 'status';
        `);
        console.log(`📊 New Status Length: ${verify.rows[0]?.character_maximum_length}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await db.pool.end();
    }
}

migrateStatusLength();
