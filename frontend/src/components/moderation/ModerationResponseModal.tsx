/**
 * Moderation Response Modal
 * 
 * Modal for users to approve or reject moderation requests
 */

import { useState } from 'react'
import { X, UserCheck, UserX, Clock, MessageSquare, Check, XIcon } from 'lucide-react'
import { 
  ModerationRequest, 
  moderationService
} from '@/services/moderationService'

interface ModerationResponseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  request: ModerationRequest | null
}

export function ModerationResponseModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  request 
}: ModerationResponseModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [error, setError] = useState('')
  
  const handleApprove = async () => {
    if (!request) return
    
    setSubmitting(true)
    setError('')
    
    try {
      await moderationService.approveRequest(request.id)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao aprovar solicitação')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleReject = async () => {
    if (!request) return
    
    setSubmitting(true)
    setError('')
    
    try {
      await moderationService.rejectRequest(request.id, rejectReason.trim() || undefined)
      onSuccess()
      onClose()
      setShowRejectForm(false)
      setRejectReason('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao rejeitar solicitação')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (!isOpen || !request) return null
  
  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Calculate time remaining to respond
  const expiresAt = new Date(request.expires_at)
  const now = new Date()
  const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)))
  const daysRemaining = Math.floor(hoursRemaining / 24)
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Solicitação de Moderação</h2>
                <p className="text-white/80 text-sm">Responda à solicitação</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {/* Moderator Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {request.moderator_name?.charAt(0).toUpperCase() || 'M'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{request.moderator_name}</p>
              <p className="text-gray-500">{request.moderator_email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                Moderador
              </span>
            </div>
          </div>
          
          {/* Request Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <Clock className="w-5 h-5 text-gray-400" />
              <span>Duração solicitada: <strong className="text-gray-900">{request.duration_label}</strong></span>
            </div>
            
            <div className="flex items-center gap-3 text-gray-600 text-sm">
              <span className="text-gray-400">Enviada em:</span>
              <span>{formatDate(request.requested_at)}</span>
            </div>
            
            {request.is_renewal && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                🔄 Esta é uma solicitação de renovação
              </div>
            )}
          </div>
          
          {/* Message */}
          {request.message && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <MessageSquare className="w-4 h-4" />
                Mensagem do moderador:
              </div>
              <p className="text-gray-700 italic">"{request.message}"</p>
            </div>
          )}
          
          {/* Time Warning */}
          {hoursRemaining < 48 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              ⏰ {daysRemaining > 0 ? `${daysRemaining} dias` : `${hoursRemaining} horas`} para responder
            </div>
          )}
          
          {/* Reject Form */}
          {showRejectForm ? (
            <div className="space-y-3 p-4 border border-red-200 bg-red-50 rounded-xl">
              <label className="block text-sm font-medium text-gray-700">
                Motivo da recusa (opcional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explique por que você está recusando..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <XIcon className="w-4 h-4" />
                      Confirmar Recusa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Actions */
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
                className="flex-1 py-3 px-4 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserX className="w-5 h-5" />
                Recusar
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Aprovar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
