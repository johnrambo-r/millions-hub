import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Module-level cache — profile is fetched once per auth session
let _cachedId = null
let _cachedProfile = null

export default function useRole() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [profile, setProfile] = useState(
    _cachedId === userId ? _cachedProfile : null
  )
  const [loading, setLoading] = useState(
    !userId ? false : _cachedId !== userId
  )

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    if (_cachedId === userId && _cachedProfile) {
      setProfile(_cachedProfile)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        _cachedId = userId
        _cachedProfile = data
        setProfile(data)
        setLoading(false)
      })
  }, [userId])

  const role = profile?.role ?? null

  return {
    role,
    isFounder: role === 'founder',
    isAccountManager: role === 'account_manager',
    isRecruiter: role === 'recruiter',
    profile,
    loading,
  }
}
