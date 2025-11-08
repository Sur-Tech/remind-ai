-- Update encrypt_token function to fail securely without default fallback
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from environment
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail securely if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured - cannot encrypt tokens. Please configure ENCRYPTION_KEY in secrets.';
  END IF;
  
  RETURN encode(
    encrypt(
      token::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$function$;

-- Update decrypt_token function to fail securely without default fallback
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from environment
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- Fail securely if encryption key is not configured
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured - cannot decrypt tokens. Please configure ENCRYPTION_KEY in secrets.';
  END IF;
  
  RETURN convert_from(
    decrypt(
      decode(encrypted_token, 'base64'),
      encryption_key::bytea,
      'aes'
    ),
    'utf8'
  );
END;
$function$;