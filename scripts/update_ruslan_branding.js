const { pool } = require('../config/database');

async function updateRuslan() {
    console.log('🔄 Upgrading Ruslan Branding to High Contrast...');
    const client = await pool.connect();

    try {
        const newBranding = {
            hero_title: "RUSLAN: THE NIGHT IS YOURS",
            hero_subtitle: "Experience Football Like Never Before.",
            theme_color: "#E60000", // Rulsan Red (High Visibility)
            cta_text: "GET VIP ACCESS",
            // Dark Stadium Night Image
            hero_image_url: "https://images.unsplash.com/photo-1510051640316-54084b11492e?q=80&w=2837&auto=format&fit=crop"
        };

        await client.query(`
            UPDATE matches 
            SET branding = $1
            WHERE team_home = 'Three Star Club' AND team_away = 'Manang Marshyangdi';
        `, [newBranding]);

        console.log('✅ Branding Updated to RED + IMAGE.');

    } catch (err) {
        console.error('❌ Error updating match:', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateRuslan();
