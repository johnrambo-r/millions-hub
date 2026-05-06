import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import AddCandidate from './pages/AddCandidate'
import Settings from './pages/Settings'

function Protected({ children }) {
  return (
    <ErrorBoundary>
      <ProtectedRoute>{children}</ProtectedRoute>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/pipeline" element={<Protected><Pipeline /></Protected>} />
          <Route path="/add" element={<Protected><AddCandidate /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
