import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Uses the service role key to bypass RLS for founder-only admin actions (invite user).
// This key is bundled in the JS build — acceptable for an internal-only tool.
// Move invite logic to a server/edge function before making the app public-facing.
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
