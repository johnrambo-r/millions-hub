import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session } = useAuth()

  // Still loading session from Supabase
  if (session === undefined) return null

  return session ? children : <Navigate to="/login" replace />
}
