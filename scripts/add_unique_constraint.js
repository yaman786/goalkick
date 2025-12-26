const db = require('../config/database');

async function migrate() {
    console.log('🔄 Starting migration to add UNIQUE constraint to payments.esewa_ref...');

    try {
        // 1. Find duplicates
        const duplicates = await db.query(`
            SELECT esewa_ref, COUNT(*) 
            FROM payments 
            WHERE esewa_ref IS NOT NULL 
            GROUP BY esewa_ref 
            HAVING COUNT(*) > 1
        `);

        console.log(`📊 Found ${duplicates.rows.length} duplicate references.`);

        // 2. Resolve duplicates
        for (const row of duplicates.rows) {
            const ref = row.esewa_ref;
            console.log(`🛠 Resolving duplicate: ${ref}`);

            // Get all payments with this ref, ordered by creation (keep oldest or newest? newest usually has more relevant info, but oldest is original)
            // Let's keep the NEWEST one as "valid" and rename older ones? Or rename NEWER ones?
            // Actually, if we rename, we just want to avoid conflict.

            const entries = await db.query(`
                SELECT id FROM payments WHERE esewa_ref = $1 ORDER BY created_at DESC
            `, [ref]);

            // Skip the first one (keep it)
            for (let i = 1; i < entries.rows.length; i++) {
                const idToRename = entries.rows[i].id;
                const newRef = `${ref}_dup_${i}`;
                await db.query(`UPDATE payments SET esewa_ref = $1 WHERE id = $2`, [newRef, idToRename]);
                console.log(`   -> Renamed ${idToRename} to ${newRef}`);
            }
        }

        // 3. Add Constraint
        console.log('🔒 Adding UNIQUE constraint...');
        await db.query(`
            ALTER TABLE payments 
            ADD CONSTRAINT unique_esewa_ref UNIQUE (esewa_ref);
        `);
        console.log('✅ Constraint added successfully!');

    } catch (error) {
        if (error.code === '42710') { // Constraint already exists
            console.log('⚠️ Constraint unique_esewa_ref already exists.');
        } else {
            console.error('❌ Migration failed:', error);
        }
    } finally {
        await db.pool.end();
    }
}

migrate();
