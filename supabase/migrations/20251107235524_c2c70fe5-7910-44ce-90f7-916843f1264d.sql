-- Add missing INSERT policy for ai_recommendations table
CREATE POLICY "Users can insert their own recommendations" 
ON public.ai_recommendations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add missing DELETE policy for ai_recommendations table
CREATE POLICY "Users can delete their own recommendations" 
ON public.ai_recommendations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create a function to encrypt/decrypt OAuth tokens using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt tokens
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Use a secret from vault or environment
  encryption_key := current_setting('app.settings.encryption_key', true);
  IF encryption_key IS NULL THEN
    encryption_key := 'default-key-change-in-production';
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
$$;

-- Create a function to decrypt tokens
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := current_setting('app.settings.encryption_key', true);
  IF encryption_key IS NULL THEN
    encryption_key := 'default-key-change-in-production';
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
$$;

-- Add trigger to automatically encrypt tokens on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_calendar_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only encrypt if the token doesn't look already encrypted (base64)
  IF NEW.access_token IS NOT NULL AND NEW.access_token !~ '^[A-Za-z0-9+/=]+$' THEN
    NEW.access_token := public.encrypt_token(NEW.access_token);
  END IF;
  
  IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token !~ '^[A-Za-z0-9+/=]+$' THEN
    NEW.refresh_token := public.encrypt_token(NEW.refresh_token);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for encryption
DROP TRIGGER IF EXISTS encrypt_tokens_trigger ON public.calendar_connections;
CREATE TRIGGER encrypt_tokens_trigger
  BEFORE INSERT OR UPDATE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_calendar_tokens();