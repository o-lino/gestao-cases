
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/common/Toast'
import { Layout } from './components/layout/Layout'
import { CaseList } from './pages/CaseList'
import { CaseDetail } from './pages/CaseDetail'
import { CaseForm } from './pages/CaseForm'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { PendingReviews } from './pages/PendingReviews'
import { Dashboard } from './pages/Dashboard'
import { ModerationPage } from './pages/ModerationPage'
import { AdminPage } from './pages/AdminPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Protected Route Wrapper
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}


import { Toaster } from './components/ui/toaster'
import { ErrorBoundary } from './components/ui/error-boundary'

const queryClient = new QueryClient()

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
            {/* @ts-ignore: Future flags not yet in types */}
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </PrivateRoute>
                  }
                />
                
                <Route
                  path="/cases"
                  element={
                    <PrivateRoute>
                      <Layout>
                        <CaseList />
                      </Layout>
                    </PrivateRoute>
                  }
                />
                
                <Route
                  path="/cases/new"
                  element={
                    <PrivateRoute>
                      <Layout>
                        <CaseForm />
                      </Layout>
                    </PrivateRoute>
                  }
                />

                <Route
                  path="/cases/:id"
                  element={
                    <PrivateRoute>
                      <Layout>
                        <CaseDetail />
                      </Layout>
                    </PrivateRoute>
                  }
                /> 
                <Route path="/settings" element={
                  <PrivateRoute>
                    <Layout>
                      <Settings />
                    </Layout>
                  </PrivateRoute>
                } />
                <Route path="/pending-reviews" element={
                  <PrivateRoute>
                    <Layout>
                      <PendingReviews />
                    </Layout>
                  </PrivateRoute>
                } />
                <Route path="/moderation" element={
                  <PrivateRoute>
                    <Layout>
                      <ModerationPage />
                    </Layout>
                  </PrivateRoute>
                } />
                <Route path="/admin" element={
                  <PrivateRoute>
                    <Layout>
                      <AdminPage />
                    </Layout>
                  </PrivateRoute>
                } />
                <Route path="/admin/users" element={
                  <PrivateRoute>
                    <Layout>
                      <AdminPage />
                    </Layout>
                  </PrivateRoute>
                } />
              </Routes>
              </Router>
              <Toaster />
            </AuthProvider>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
