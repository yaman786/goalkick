const db = require('../config/database');

async function checkSchema() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'payments';
        `);
        console.table(res.rows);

        const constraints = await db.query(`
             SELECT conname, pg_get_constraintdef(oid)
             FROM pg_constraint
             WHERE conrelid = 'payments'::regclass;
        `);
        console.table(constraints.rows);

    } catch (err) {
        console.error(err);
    } finally {
        db.pool.end();
    }
}

checkSchema();
