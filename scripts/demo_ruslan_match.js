const { pool } = require('../config/database');

async function createDemoMatch() {
    console.log('🚀 Creating "Ruslan Classico" Demo Match...');
    const client = await pool.connect();

    try {
        const branding = {
            hero_title: "RUSLAN PRESENTS: THE CLASSICO",
            hero_subtitle: "Three Star vs MMC. The Battle for Pride.",
            theme_color: "#1C1C1C", // Ruslan Black
            cta_text: "Join the Legacy",
            sponsor_logo_url: ""
        };

        // Date: Tomorrow at 5 PM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(17, 0, 0, 0);

        const res = await client.query(`
            INSERT INTO matches (team_home, team_away, match_date, venue, price, total_seats, available_seats, is_active, branding)
            VALUES ($1, $2, $3, $4, $5, $6, $6, true, $7)
            RETURNING id;
        `, ['Three Star Club', 'Manang Marshyangdi', tomorrow, 'Dasharath Stadium', 1500, 15000, branding]);

        console.log(`✅ Match Created! ID: ${res.rows[0].id}`);
        console.log('🎉 The Website Skinning should now be active.');

    } catch (err) {
        console.error('❌ Error creating demo match:', err);
    } finally {
        client.release();
        pool.end();
    }
}

createDemoMatch();
