-- Atomic message append function to fix race conditions
CREATE OR REPLACE FUNCTION public.append_conversation_message(
  p_conversation_id UUID,
  p_user_id UUID,
  p_message JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  -- Atomic update with ownership check
  UPDATE conversations
  SET 
    messages = COALESCE(messages, '[]'::jsonb) || jsonb_build_array(p_message),
    last_modified = NOW()
  WHERE 
    id = p_conversation_id 
    AND user_id = p_user_id
  RETURNING id INTO v_updated_id;
  
  -- If no rows were updated, either conversation doesn't exist or user doesn't own it
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Conversation not found or access denied';
  END IF;
  
  RETURN v_updated_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.append_conversation_message TO authenticated;
