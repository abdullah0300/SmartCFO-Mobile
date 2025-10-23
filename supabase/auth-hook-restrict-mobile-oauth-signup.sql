-- Supabase Auth Hook: Restrict Mobile OAuth Signup
-- This hook prevents new user signups via OAuth (Google/LinkedIn) from the mobile app.
-- Mobile users must create an account on the web app first.
--
-- SETUP INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Authentication → Hooks
-- 2. Create a new "Before User Created" hook
-- 3. Select "Postgres Function"
-- 4. Use function: public.check_user_exists_for_oauth
--
-- Then run this SQL in the Supabase SQL Editor:

DROP FUNCTION IF EXISTS public.check_user_exists_for_oauth(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.check_user_exists_for_oauth(
  event jsonb,
  jwt_claims jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
  is_oauth boolean;
  is_mobile boolean;
  email_exists boolean;
  provider text;
BEGIN
  -- Extract user email
  user_email := event->'user'->>'email';

  -- Get OAuth provider (google, linkedin_oidc, etc.)
  provider := event->'user'->'app_metadata'->>'provider';

  -- Check if this is an OAuth sign-in (not email/password)
  is_oauth := provider IS NOT NULL AND provider != 'email';

  -- Check if request is from mobile app (via user_metadata.platform)
  is_mobile := (event->'user'->'user_metadata'->>'platform') = 'mobile';

  -- Only restrict OAuth signup from mobile apps
  IF is_oauth AND is_mobile THEN
    -- Check if user account already exists
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE email = user_email
    ) INTO email_exists;

    -- Block signup if account doesn't exist
    IF NOT email_exists THEN
      RETURN jsonb_build_object(
        'error', jsonb_build_object(
          'http_code', 403,
          'message', 'Account not found. Please create an account on our website first: https://smartcfo.webcraftio.com/register'
        )
      );
    END IF;
  END IF;

  -- Allow all other cases:
  -- - Web OAuth (signup/login) ✅
  -- - Mobile OAuth (existing users) ✅
  -- - Email/password (signup/login) ✅
  RETURN jsonb_build_object('decision', 'continue');
END;
$function$;

-- Grant execute permission to Supabase auth admin
GRANT EXECUTE ON FUNCTION public.check_user_exists_for_oauth(jsonb, jsonb) TO supabase_auth_admin;

-- TESTING:
-- After setting up the hook, test with:
-- 1. Mobile app + Google OAuth + NEW email → Should be blocked ❌
-- 2. Mobile app + Google OAuth + EXISTING email → Should work ✅
-- 3. Web app + Google OAuth + NEW email → Should work ✅
-- 4. Mobile app + Email/Password login → Should work ✅
