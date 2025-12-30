const db = require('../config/database');

const matches = [
    {
        team_home: 'मनाङ मर्स्याङ्दी एफसी',
        team_away: 'थ्री स्टार क्लब',
        match_date: '2026-01-15T15:00:00.000Z', // Maagh 1
        venue: 'दशरथ रंगशाला, काठमाडौँ',
        price: 500,
        total_seats: 15000,
        available_seats: 15000,
        is_active: true
    },
    {
        team_home: 'मछिन्द्र एफसी',
        team_away: 'एपीएफ क्लब',
        match_date: '2026-01-20T14:00:00.000Z', // Maagh 6
        venue: 'एन्फा कम्प्लेक्स, सातदोबाटो',
        price: 300,
        total_seats: 500,
        available_seats: 500,
        is_active: true
    },
    {
        team_home: 'नेपाल आर्मी क्लब',
        team_away: 'जावलाखेल युथ क्लब',
        match_date: '2026-01-25T16:00:00.000Z', // Maagh 11
        venue: 'दशरथ रंगशाला, काठमाडौँ',
        price: 400,
        total_seats: 1000,
        available_seats: 1000,
        is_active: true
    },
    {
        team_home: 'संकटा क्लब',
        team_away: 'हिमालयन शेर्पा क्लब',
        match_date: '2026-02-01T15:30:00.000Z', // Maagh 18
        venue: 'एन्फा कम्प्लेक्स, सातदोबाटो',
        price: 350,
        total_seats: 600,
        available_seats: 600,
        is_active: true
    },
    {
        team_home: 'नेपाल पुलिस क्लब',
        team_away: 'सुदूरपश्चिम एफसी',
        match_date: '2026-02-10T14:30:00.000Z', // Falgun 28 (Approx)
        venue: 'दशरथ रंगशाला, काठमाडौँ',
        price: 450,
        total_seats: 900,
        available_seats: 900,
        is_active: true
    }
];

async function seed() {
    try {
        console.log('🗑️  Deleting existing data...');
        await db.query('DELETE FROM payments');
        await db.query('DELETE FROM tickets');
        await db.query('DELETE FROM matches');

        console.log('🌱 Inserting Nepali matches...');
        for (const match of matches) {
            await db.query(`
                INSERT INTO matches (
                    team_home, team_away, match_date, venue, price, 
                    total_seats, available_seats, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                match.team_home,
                match.team_away,
                match.match_date,
                match.venue,
                match.price,
                match.total_seats,
                match.available_seats,
                match.is_active
            ]);
        }

        console.log('✅ Database successfully seeded with Nepali content!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seed();
