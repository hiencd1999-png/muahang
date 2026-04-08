# Test Credentials (Development Only)

The following test accounts are created when you run `npm run db:seed`:

## Admin Account
- **Username:** `admin`
- **Password:** `Admin123`
- **Email:** `admin@datdon.local`
- **Phone:** `0900000001`
- **Role:** ADMIN
- **Balance:** 5,000,000 VND

**Access:** `/admin` (admin panel)

## Test User Account
- **Username:** `testuser`
- **Password:** `Test123`
- **Email:** `testuser@datdon.local`
- **Phone:** `0900000002`
- **Role:** USER
- **Balance:** 500,000 VND

**Access:** `/dashboard` (user dashboard)

---

## Password Requirements

All passwords must meet these requirements:
- Minimum 6 characters
- At least 1 uppercase letter (A-Z)
- At least 1 digit (0-9)

Examples of valid passwords:
- `Admin123`
- `Test123`
- `MyPass1`
- `Password99`

## Reset Database

To reset the database and reseed with fresh test data:

```bash
npm run db:push -- --force-reset
npm run db:seed
```

⚠️ Warning: This will **delete all data** in the development database.
