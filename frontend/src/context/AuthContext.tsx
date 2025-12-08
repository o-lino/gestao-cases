
import React, { createContext, useContext, useState, useEffect } from 'react'

// User role constants
export const UserRole = {
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const

export type UserRoleType = typeof UserRole[keyof typeof UserRole]

interface User {
  id: number
  name: string
  email: string
  role: UserRoleType
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
  // Role helpers
  isAdmin: () => boolean
  isModerator: () => boolean
  isModeratorOrAbove: () => boolean
  canApprove: () => boolean
  canManageUsers: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for token in localStorage on mount
    const token = localStorage.getItem('token')
    if (token) {
      // TODO: Validate token with backend and fetch user details
      // Mock user for now
      setUser({
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: UserRole.ADMIN
      })
    }
    setLoading(false)
  }, [])

  const login = (token: string) => {
    localStorage.setItem('token', token)
    // Mock user set - in real app, decode JWT or fetch from /users/me
    setUser({
      id: 1,
      name: 'Admin User',
      email: 'admin@example.com',
      role: UserRole.ADMIN
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  // Role helper functions
  const isAdmin = () => user?.role === UserRole.ADMIN
  const isModerator = () => user?.role === UserRole.MODERATOR
  const isModeratorOrAbove = () => user?.role === UserRole.MODERATOR || user?.role === UserRole.ADMIN
  const canApprove = () => isModeratorOrAbove()
  const canManageUsers = () => isAdmin()

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading: loading, 
      login, 
      logout,
      isAdmin,
      isModerator,
      isModeratorOrAbove,
      canApprove,
      canManageUsers,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
