
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { authService } from '../services/authService'

export function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await authService.login(email, password)
      login(response.access_token)
    } catch (err: any) {
      // authService uses fetch, so err.message contains the actual error
      // err.response?.data?.detail would be for axios
      console.error('Login error:', err)
      const errorMessage = err.message || 'Erro ao fazer login'
      // Extract the detail from the error message if present
      if (errorMessage.includes('Incorrect email or password')) {
        setError('Email ou senha inválidos')
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError('Erro de conexão. Verifique sua rede.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <FolderOpen className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-center">Gestão Cases</h1>
          <p className="text-xl text-white/90 text-center max-w-md">
            Plataforma completa para gerenciamento de cases e variáveis
          </p>
          
          {/* Feature highlights */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Gerencie seus cases de forma eficiente</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Acompanhe variáveis e aprovações</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Colabore com sua equipe em tempo real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl text-white">
                <FolderOpen className="h-8 w-8" />
              </div>
              <span className="text-2xl font-bold text-gray-800">Gestão Cases</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">
                Bem-vindo de volta
              </h2>
              <p className="mt-2 text-gray-500">
                Entre com suas credenciais para acessar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-500">
            © 2026 Gestão Cases. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
