const { pool } = require('../config/database');

async function switchToNcell() {
    console.log('🔄 Switching Branding to Ncell (Purple)...');
    const client = await pool.connect();

    try {
        const ncellBranding = {
            hero_title: "NCELL CONNECT CUP",
            hero_subtitle: "Here for the Game. Here for Nepal.",
            theme_color: "#9d29b2", // Ncell Purple
            cta_text: "GET CONNECTED",
            // Blue/Purple Crowd Stadium Shot
            hero_image_url: "https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2940&auto=format&fit=crop"
        };

        // Update the SAME match (Three Star vs MMC)
        await client.query(`
            UPDATE matches 
            SET branding = $1
            WHERE team_home = 'Three Star Club' AND team_away = 'Manang Marshyangdi';
        `, [ncellBranding]);

        console.log('✅ Branding Switched to NCELL (Purple).');

    } catch (err) {
        console.error('❌ Error updating match:', err);
    } finally {
        client.release();
        pool.end();
    }
}

switchToNcell();
