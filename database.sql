-- =============================================
-- GoalKick Lite - Football Ticketing System
-- Database Schema for PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone);

-- =============================================
-- MATCHES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_home VARCHAR(100) NOT NULL,
    team_away VARCHAR(100) NOT NULL,
    match_date TIMESTAMP NOT NULL,
    venue VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    total_seats INTEGER NOT NULL DEFAULT 1000,
    available_seats INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_active ON matches(is_active);

-- =============================================
-- TICKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    qr_code VARCHAR(20) UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Status: PENDING, PAID, FAILED, CANCELLED, REFUNDED
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_qr ON tickets(qr_code);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_match ON tickets(match_id);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    esewa_ref VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Status: PENDING, SUCCESS, FAILED, REFUNDED
    verification_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_ticket ON payments(ticket_id);
CREATE INDEX idx_payments_esewa_ref ON payments(esewa_ref);
CREATE INDEX idx_payments_status ON payments(status);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert sample matches
INSERT INTO matches (team_home, team_away, match_date, venue, price, total_seats, available_seats) VALUES
    ('Manang Marshyangdi FC', 'Three Star Club', '2025-01-15 15:00:00', 'Dasharath Stadium, Kathmandu', 500.00, 1000, 1000),
    ('Machhindra FC', 'APF Club', '2025-01-20 14:00:00', 'ANFA Complex, Satdobato', 300.00, 500, 500),
    ('Nepal Army Club', 'Jawalakhel Youth Club', '2025-01-25 16:00:00', 'Dasharath Stadium, Kathmandu', 400.00, 800, 800),
    ('Sankata Club', 'Himalayan Sherpa Club', '2025-02-01 15:30:00', 'ANFA Complex, Satdobato', 350.00, 600, 600),
    ('Nepal Police Club', 'Far West FC', '2025-02-10 14:30:00', 'Dasharath Stadium, Kathmandu', 450.00, 900, 900);

-- Insert a sample user for testing
INSERT INTO users (phone, name, email) VALUES
    ('9841234567', 'Test User', 'test@example.com');

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- View for match ticket summary
CREATE OR REPLACE VIEW match_ticket_summary AS
SELECT 
    m.id,
    m.team_home,
    m.team_away,
    m.match_date,
    m.venue,
    m.price,
    m.total_seats,
    m.available_seats,
    COUNT(t.id) FILTER (WHERE t.status = 'PAID') as tickets_sold,
    COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'PAID'), 0) as revenue
FROM matches m
LEFT JOIN tickets t ON m.id = t.match_id
GROUP BY m.id;

COMMENT ON TABLE users IS 'User accounts with phone-based authentication';
COMMENT ON TABLE matches IS 'Football match listings with seat availability';
COMMENT ON TABLE tickets IS 'Ticket records with QR codes and usage tracking';
COMMENT ON TABLE payments IS 'eSewa payment transaction logs';
