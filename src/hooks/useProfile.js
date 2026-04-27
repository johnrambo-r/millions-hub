import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useProfile() {
  const { session } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return

    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        console.log('[useProfile] response →', { data, error })
        setProfile(data)
      })
  }, [session])

  return profile
}
