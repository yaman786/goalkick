# Staff Management & Secure Gatekeeper Implementation Plan

## Goal
Secure the "Gatekeeper" QR scanner so it is not publicly accessible. Implement a "Staff" role that only has access to scanning, while "Admins" have full access. Allow Admins to create and manage Staff accounts.

## User Review Required
> [!IMPORTANT]
> This change introduces a **Staff** role. Existing admin users will be migrated to the 'admin' role. Steps to create the first staff user will be provided.

## Proposed Changes

### Database
#### [MODIFY] [database.sql](file:///Users/amanrana/Desktop/qr_ticketing/database.sql)
- Add `role` column to `admins` table (VARCHAR, default 'admin').
- Add script to backfill existing admins with 'admin' role.

### Middleware
#### [MODIFY] [middleware/adminAuth.js](file:///Users/amanrana/Desktop/qr_ticketing/middleware/adminAuth.js)
- Update `requireAdmin` to enforce `role === 'admin'`.
- Create new `requireGatekeeper` middleware that allows both 'admin' and 'staff' roles.
- Update `attachAdminToLocals` to expose `admin.role` to views.

### Routes
#### [MODIFY] [routes/admin.js](file:///Users/amanrana/Desktop/qr_ticketing/routes/admin.js)
- Add staff management routes:
    - `GET /admin/staff` (List staff)
    - `POST /admin/staff` (Create staff)
    - `POST /admin/staff/:id/delete` (Delete staff)

#### [MODIFY] [routes/gatekeeper.js](file:///Users/amanrana/Desktop/qr_ticketing/routes/gatekeeper.js)
- Protect all routes with `requireGatekeeper` middleware.

### Views
#### [MODIFY] [views/layout.ejs](file:///Users/amanrana/Desktop/qr_ticketing/views/layout.ejs)
- Remove public "Gatekeeper" link.

#### [MODIFY] [views/admin/layout.ejs](file:///Users/amanrana/Desktop/qr_ticketing/views/admin/layout.ejs)
- Add "Staff" link to sidebar (visible only to admins).
- Add "Gatekeeper" link to sidebar (visible to all logged-in users).

#### [NEW] [views/admin/staff.ejs](file:///Users/amanrana/Desktop/qr_ticketing/views/admin/staff.ejs)
- Interface to list and create staff members.

#### [MODIFY] [views/gatekeeper.ejs](file:///Users/amanrana/Desktop/qr_ticketing/views/gatekeeper.ejs)
- Add "Back to Dashboard" and "Logout" buttons since it's now a secure area.

## Verification Plan

### Automated Tests
- None (Manual verification required for UI/Auth flow).

### Manual Verification
1. **Public Security Check:**
   - Visit `/gatekeeper` incognito -> Should redirect to `/admin/login`.
   - specific scan check `/validate_ticket` -> Should fail 401/403.

2. **Admin Management:**
   - Login as Admin.
   - Go to "Staff" tab.
   - Create new staff user `gatekeeper1` / `pass123`.
   - Verify staff appears in list.

3. **Staff Access:**
   - Logout Admin.
   - Login as `gatekeeper1`.
   - Verify redirected to `/gatekeeper` (or dashboard with limited options).
   - Try to access `/admin/matches` -> Should be denied.
   - Access `/gatekeeper` -> Should work.

4. **Scanning:**
   - Use Staff account to scan a valid ticket QR.
   - Verify ticket is marked used.
