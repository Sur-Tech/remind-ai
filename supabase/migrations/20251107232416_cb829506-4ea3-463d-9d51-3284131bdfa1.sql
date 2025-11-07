-- Create table for AI routine recommendations
CREATE TABLE public.ai_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendations TEXT NOT NULL,
  routine_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own recommendations" 
ON public.ai_recommendations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations" 
ON public.ai_recommendations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_ai_recommendations_user_id ON public.ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_created_at ON public.ai_recommendations(created_at DESC);