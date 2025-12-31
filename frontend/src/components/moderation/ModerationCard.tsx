/**
 * Moderation Card
 * 
 * Card displaying an active moderation association
 */

import { useState } from 'react'
import { Clock, Calendar, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { 
  ModerationAssociation, 
  moderationService,
  ASSOCIATION_STATUS_LABELS,
  ASSOCIATION_STATUS_COLORS
} from '@/services/moderationService'

interface ModerationCardProps {
  association: ModerationAssociation
  viewAs: 'moderator' | 'user'  // Who is viewing: the moderator or the moderated user
  onRevoked: () => void
  onRenew?: (association: ModerationAssociation) => void
}

export function ModerationCard({ 
  association, 
  viewAs, 
  onRevoked,
  onRenew 
}: ModerationCardProps) {
  const [revoking, setRevoking] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const handleRevoke = async () => {
    setRevoking(true)
    try {
      await moderationService.revokeAssociation(association.id)
      onRevoked()
    } catch (err) {
      console.error('Failed to revoke:', err)
    } finally {
      setRevoking(false)
      setShowConfirm(false)
    }
  }
  
  // Calculate progress
  const startDate = new Date(association.started_at)
  const endDate = new Date(association.expires_at)
  const now = new Date()
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  
  const isExpiringSoon = association.days_remaining <= 15 && association.is_active
  const isExpired = !association.is_active || association.status === 'EXPIRED'
  
  // Format dates
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }
  
  // Person to display
  const displayName = viewAs === 'moderator' ? association.user_name : association.moderator_name
  const displayEmail = viewAs === 'moderator' ? association.user_email : association.moderator_email
  const roleLabel = viewAs === 'moderator' ? 'Usuário moderado' : 'Seu moderador'
  
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
      isExpired ? 'opacity-60' : ''
    } ${isExpiringSoon ? 'border-yellow-300' : 'border-gray-200'}`}>
      {/* Expiring Warning Banner */}
      {isExpiringSoon && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-yellow-700 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Expira em <strong>{association.days_remaining} dias</strong></span>
        </div>
      )}
      
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
              viewAs === 'moderator' 
                ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                : 'bg-gradient-to-br from-blue-400 to-indigo-500'
            }`}>
              {displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{displayName}</p>
              <p className="text-sm text-gray-500">{displayEmail}</p>
              <span className="text-xs text-gray-400">{roleLabel}</span>
            </div>
          </div>
          
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            ASSOCIATION_STATUS_COLORS[association.status]
          }`}>
            {ASSOCIATION_STATUS_LABELS[association.status]}
          </span>
        </div>
        
        {/* Progress Bar */}
        {association.is_active && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{formatDate(association.started_at)}</span>
              <span>{formatDate(association.expires_at)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all rounded-full ${
                  isExpiringSoon 
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                    : 'bg-gradient-to-r from-green-400 to-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{association.days_remaining} dias restantes</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Iniciou {formatDate(association.started_at)}</span>
          </div>
        </div>
        
        {/* Actions */}
        {association.is_active && (
          <div className="flex gap-2">
            {viewAs === 'moderator' && onRenew && association.days_remaining <= 30 && (
              <button
                onClick={() => onRenew(association)}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Renovar
              </button>
            )}
            
            {showConfirm ? (
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 px-3 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex-1 py-2 px-3 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {revoking ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex-1 py-2 px-4 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Encerrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
