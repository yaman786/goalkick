#!/usr/bin/env node
/**
 * GoalKick Lite - Create Admin User Script
 * Usage: node scripts/create-admin.js <username> <password> [name]
 */

const bcrypt = require('bcrypt');
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

async function createAdmin() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node scripts/create-admin.js <username> <password> [name]');
        console.log('Example: node scripts/create-admin.js admin password123 "Admin User"');
        process.exit(1);
    }

    const username = args[0].toLowerCase();
    const password = args[1];
    const name = args[2] || username;

    try {
        // First, ensure the admins table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                role VARCHAR(20) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'staff')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if username already exists
        const existing = await pool.query('SELECT id FROM admins WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            console.log(`❌ Admin with username '${username}' already exists.`);
            process.exit(1);
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert admin
        await pool.query(
            'INSERT INTO admins (username, password_hash, name, role) VALUES ($1, $2, $3, $4)',
            [username, passwordHash, name, 'admin']
        );

        console.log('');
        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('  Username:', username);
        console.log('  Password:', password);
        console.log('  Name:', name);
        console.log('');
        console.log('🔗 Login at: http://localhost:3000/admin/login');
        console.log('');

    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createAdmin();
