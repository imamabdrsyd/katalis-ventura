-- Migration: Create agent_memories table
-- Description: Stores AI agent chat history and manual memories.

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_memories_business_user ON public.agent_memories(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_session ON public.agent_memories(session_id);

-- RLS Policies
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent memories"
  ON public.agent_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent memories"
  ON public.agent_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent memories"
  ON public.agent_memories FOR DELETE
  USING (auth.uid() = user_id);
