# Supabase Database Setup

This folder contains SQL scripts and migrations for the SmartCFO Mobile app's Supabase backend.

## Auth Hook: Restrict Mobile OAuth Signup

**File:** `auth-hook-restrict-mobile-oauth-signup.sql`

### What it does:

- Prevents new users from signing up via OAuth (Google/LinkedIn) on the mobile app
- Mobile users must create accounts on the web app first: https://smartcfo.webcraftio.com/register
- Existing users can still log in via OAuth on mobile ✅
- Web app OAuth signup/login works normally ✅

### Setup Instructions:

1. **Run the SQL function:**
   - Open Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `auth-hook-restrict-mobile-oauth-signup.sql`
   - Run the script

2. **Enable the hook:**
   - Go to Supabase Dashboard → Authentication → Hooks
   - Click "Create a new hook"
   - Select "Before User Created"
   - Choose "Postgres Function"
   - Select function: `public.check_user_exists_for_oauth`
   - Save

### How it works:

1. Mobile app adds `platform: 'mobile'` metadata to OAuth requests
2. Supabase hook checks if:
   - Request is OAuth (Google/LinkedIn)
   - AND request is from mobile app
   - AND email doesn't exist in database
3. If all true → Block with error message
4. Otherwise → Allow

### Testing:

| Scenario | Mobile App | Web App |
|----------|-----------|---------|
| OAuth Signup (NEW user) | ❌ Blocked | ✅ Allowed |
| OAuth Login (existing) | ✅ Allowed | ✅ Allowed |
| Email/Password Login | ✅ Allowed | ✅ Allowed |
| Email/Password Signup | N/A (redirects to web) | ✅ Allowed |

### Troubleshooting:

If mobile OAuth signup is still working:
1. Verify the hook is enabled in Supabase Dashboard → Authentication → Hooks
2. Check function permissions: `GRANT EXECUTE ON FUNCTION public.check_user_exists_for_oauth(jsonb, jsonb) TO supabase_auth_admin;`
3. Check mobile app is sending `platform: 'mobile'` metadata (see `src/hooks/useAuth.tsx` line 142-144)
