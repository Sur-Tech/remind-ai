-- Create calendar_connections table to store OAuth tokens
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create calendar_events table to store synced events
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  event_date DATE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(calendar_connection_id, external_event_id)
);

-- Enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_connections
CREATE POLICY "Users can view their own calendar connections"
ON public.calendar_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections"
ON public.calendar_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
ON public.calendar_connections FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for calendar_events
CREATE POLICY "Users can view their own calendar events"
ON public.calendar_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for calendar_connections
CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_calendar_connections_user_id ON public.calendar_connections(user_id);
CREATE INDEX idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_connection_id ON public.calendar_events(calendar_connection_id);