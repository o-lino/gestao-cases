/**
 * Moderation Request Modal
 * 
 * Modal for moderators to create a moderation request
 */

import { useState, useEffect } from 'react'
import { X, UserPlus, Clock, Send, Search } from 'lucide-react'
import { 
  moderationService, 
  UserSummary, 
  ModerationDuration,
  DURATION_LABELS 
} from '@/services/moderationService'

interface ModerationRequestModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedUser?: UserSummary | null
}

export function ModerationRequestModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  preselectedUser 
}: ModerationRequestModalProps) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  
  // Form state
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(preselectedUser || null)
  const [duration, setDuration] = useState<ModerationDuration>('3_MONTHS')
  const [message, setMessage] = useState('')
  
  useEffect(() => {
    if (isOpen && !preselectedUser) {
      loadAvailableUsers()
    }
    if (preselectedUser) {
      setSelectedUser(preselectedUser)
    }
  }, [isOpen, preselectedUser])
  
  const loadAvailableUsers = async () => {
    setLoading(true)
    try {
      const data = await moderationService.getAvailableUsers()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser) {
      setError('Selecione um usuário')
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      await moderationService.createRequest({
        user_id: selectedUser.id,
        duration,
        message: message.trim() || undefined
      })
      onSuccess()
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao criar solicitação')
    } finally {
      setSubmitting(false)
    }
  }
  
  const resetForm = () => {
    setSelectedUser(null)
    setDuration('3_MONTHS')
    setMessage('')
    setSearchTerm('')
    setError('')
  }
  
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Solicitar Moderação</h2>
                <p className="text-white/80 text-sm">Selecione um usuário para moderar</p>
              </div>
            </div>
            <button 
              onClick={() => { onClose(); resetForm(); }}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {/* User Selection */}
          {!preselectedUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuário
              </label>
              
              {selectedUser ? (
                <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-medium">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedUser.name}</p>
                      <p className="text-sm text-gray-500">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar usuário..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">Carregando...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {preselectedUser && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-medium">
                {preselectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{preselectedUser.name}</p>
                <p className="text-sm text-gray-500">{preselectedUser.email}</p>
              </div>
            </div>
          )}
          
          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Duração
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(DURATION_LABELS) as [ModerationDuration, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  className={`py-2.5 px-4 rounded-lg border-2 font-medium text-sm transition-all ${
                    duration === value
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensagem (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explique por que você deseja moderar este usuário..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedUser}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Solicitação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
