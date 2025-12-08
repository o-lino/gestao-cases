/**
 * Moderation Page
 * 
 * Main page for managing moderator-user associations
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Users, 
  UserPlus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  Inbox,
  History,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { 
  moderationService, 
  ModerationRequest, 
  ModerationAssociation,
  UserSummary,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS
} from '@/services/moderationService'
import { ModerationRequestModal } from '@/components/moderation/ModerationRequestModal'
import { ModerationResponseModal } from '@/components/moderation/ModerationResponseModal'
import { ModerationCard } from '@/components/moderation/ModerationCard'

type TabType = 'users' | 'moderator' | 'sent' | 'received' | 'history'

export function ModerationPage() {
  const { user, isModeratorOrAbove } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || (isModeratorOrAbove() ? 'users' : 'moderator')
  )
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Data
  const [myModerator, setMyModerator] = useState<UserSummary | null>(null)
  const [myUsers, setMyUsers] = useState<Array<{ user: UserSummary; association: ModerationAssociation }>>([])
  const [sentRequests, setSentRequests] = useState<ModerationRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<ModerationRequest[]>([])
  const [associations, setAssociations] = useState<ModerationAssociation[]>([])
  
  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showResponseModal, setShowResponseModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ModerationRequest | null>(null)
  const [renewAssociation, setRenewAssociation] = useState<ModerationAssociation | null>(null)
  
  // Load data
  useEffect(() => {
    loadData()
  }, [refreshKey])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [moderator, requests, assocs] = await Promise.all([
        moderationService.getMyModerator(),
        moderationService.getRequests('all'),
        moderationService.getAssociations()
      ])
      
      setMyModerator(moderator)
      setAssociations(assocs)
      
      // Split requests
      setSentRequests(requests.filter(r => r.moderator_id === user?.id))
      setReceivedRequests(requests.filter(r => r.user_id === user?.id && r.status === 'PENDING'))
      
      // Load moderated users if moderator
      if (isModeratorOrAbove()) {
        const users = await moderationService.getMyUsers()
        setMyUsers(users)
      }
    } catch (err) {
      console.error('Failed to load moderation data:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }
  
  const handleSuccess = () => {
    setRefreshKey(k => k + 1)
  }
  
  const handleRespondToRequest = (request: ModerationRequest) => {
    setSelectedRequest(request)
    setShowResponseModal(true)
  }
  
  const handleRenew = (association: ModerationAssociation) => {
    setRenewAssociation(association)
    setShowRequestModal(true)
  }
  
  // Count pending received requests
  const pendingCount = receivedRequests.filter(r => r.is_pending).length
  
  // Tabs configuration
  const tabs: Array<{ id: TabType; label: string; icon: any; show: boolean; badge?: number }> = [
    { id: 'users', label: 'Meus Usuários', icon: Users, show: isModeratorOrAbove() },
    { id: 'moderator', label: 'Meu Moderador', icon: Users, show: true },
    { id: 'sent', label: 'Enviadas', icon: Send, show: isModeratorOrAbove() },
    { id: 'received', label: 'Recebidas', icon: Inbox, show: true, badge: pendingCount },
    { id: 'history', label: 'Histórico', icon: History, show: true },
  ]
  
  const visibleTabs = tabs.filter(t => t.show)
  
  // Format date helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moderação</h1>
            <p className="text-gray-500">Gerencie suas associações de moderação</p>
          </div>
        </div>
        
        {isModeratorOrAbove() && (
          <button
            onClick={() => { setRenewAssociation(null); setShowRequestModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
          >
            <UserPlus className="w-5 h-5" />
            Nova Solicitação
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
      
      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* My Users Tab (Moderator) */}
            {activeTab === 'users' && isModeratorOrAbove() && (
              <div className="space-y-4">
                {myUsers.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Você ainda não modera nenhum usuário</p>
                    <button
                      onClick={() => setShowRequestModal(true)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                    >
                      <UserPlus className="w-4 h-4" />
                      Solicitar Moderação
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {myUsers.map(({ user: u, association }) => (
                      <ModerationCard
                        key={association.id}
                        association={association}
                        viewAs="moderator"
                        onRevoked={handleSuccess}
                        onRenew={handleRenew}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* My Moderator Tab */}
            {activeTab === 'moderator' && (
              <div className="max-w-lg">
                {myModerator ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {myModerator.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-gray-900">{myModerator.name}</p>
                        <p className="text-gray-500">{myModerator.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Seu Moderador
                        </span>
                      </div>
                    </div>
                    
                    {/* Find active association for more details */}
                    {associations.filter(a => a.moderator_id === myModerator.id && a.is_active).map(assoc => (
                      <ModerationCard
                        key={assoc.id}
                        association={assoc}
                        viewAs="user"
                        onRevoked={handleSuccess}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-2">Você não possui um moderador ativo</p>
                    <p className="text-sm text-gray-400">
                      Um moderador precisa solicitar sua moderação para que a associação seja criada
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Sent Requests Tab */}
            {activeTab === 'sent' && isModeratorOrAbove() && (
              <div className="space-y-3">
                {sentRequests.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma solicitação enviada</p>
                  </div>
                ) : (
                  sentRequests.map(request => (
                    <div key={request.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-medium">
                          {request.user_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{request.user_name}</p>
                          <p className="text-sm text-gray-500">
                            {request.duration_label} • {formatDate(request.requested_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          REQUEST_STATUS_COLORS[request.status]
                        }`}>
                          {REQUEST_STATUS_LABELS[request.status]}
                        </span>
                        
                        {request.status === 'PENDING' && (
                          <button
                            onClick={async () => {
                              await moderationService.cancelRequest(request.id)
                              handleSuccess()
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* Received Requests Tab */}
            {activeTab === 'received' && (
              <div className="space-y-3">
                {receivedRequests.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma solicitação pendente</p>
                  </div>
                ) : (
                  receivedRequests.filter(r => r.is_pending).map(request => (
                    <div key={request.id} className="bg-white rounded-xl border-2 border-blue-200 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                            {request.moderator_name?.charAt(0).toUpperCase() || 'M'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{request.moderator_name}</p>
                            <p className="text-sm text-gray-500">{request.moderator_email}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>Duração: <strong>{request.duration_label}</strong></span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleRespondToRequest(request)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-600"
                        >
                          Responder
                        </button>
                      </div>
                      
                      {request.message && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 italic">
                          "{request.message}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {associations.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum histórico de moderação</p>
                  </div>
                ) : (
                  associations.map(assoc => (
                    <div key={assoc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                          assoc.moderator_id === user?.id
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                            : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                        }`}>
                          {(assoc.moderator_id === user?.id ? assoc.user_name : assoc.moderator_name)?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {assoc.moderator_id === user?.id 
                              ? `Você → ${assoc.user_name}` 
                              : `${assoc.moderator_name} → Você`
                            }
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(assoc.started_at)} - {formatDate(assoc.expires_at)}
                          </p>
                        </div>
                      </div>
                      
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        assoc.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {assoc.is_active ? 'Ativa' : assoc.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Modals */}
      <ModerationRequestModal
        isOpen={showRequestModal}
        onClose={() => { setShowRequestModal(false); setRenewAssociation(null); }}
        onSuccess={handleSuccess}
        preselectedUser={renewAssociation ? {
          id: renewAssociation.user_id,
          name: renewAssociation.user_name || '',
          email: renewAssociation.user_email || '',
          role: 'USER'
        } : null}
      />
      
      <ModerationResponseModal
        isOpen={showResponseModal}
        onClose={() => { setShowResponseModal(false); setSelectedRequest(null); }}
        onSuccess={handleSuccess}
        request={selectedRequest}
      />
    </div>
  )
}
