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
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { 
  moderationService, 
  ModerationRequest, 
  ModerationAssociation,
  UserSummary,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  ASSOCIATION_STATUS_LABELS,
  ASSOCIATION_STATUS_COLORS
} from '@/services/moderationService'
import { ModerationRequestModal } from '@/components/moderation/ModerationRequestModal'
import { ModerationResponseModal } from '@/components/moderation/ModerationResponseModal'
import { ModerationCard } from '@/components/moderation/ModerationCard'
import { PageLayout, PageTab } from '@/components/common/PageLayout'

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
  
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType)
    setSearchParams({ tab: tabId })
  }

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

  const handleSuccess = () => {
    setShowRequestModal(false)
    setShowResponseModal(false)
    setRefreshKey(prev => prev + 1)
  }

  const handleRequestClick = (request: ModerationRequest) => {
    if (request.status === 'PENDING' && request.user_id === user?.id) {
      setSelectedRequest(request)
      setShowResponseModal(true)
    }
  }

  const tabs: PageTab[] = [
    { 
      id: 'users', 
      label: 'Meus Usuários', 
      icon: Users,
      show: isModeratorOrAbove()
    },
    { 
      id: 'moderator', 
      label: 'Meu Moderador', 
      icon: Users 
    },
    { 
      id: 'sent', 
      label: 'Solicitações Enviadas', 
      icon: Send,
      show: isModeratorOrAbove()
    },
    { 
      id: 'received', 
      label: 'Solicitações Recebidas', 
      icon: Inbox,
      badge: receivedRequests.length,
      show: receivedRequests.length > 0
    },
    { 
      id: 'history', 
      label: 'Histórico', 
      icon: History 
    }
  ]

  const headerActions = isModeratorOrAbove() ? (
    <button
      onClick={() => { setRenewAssociation(null); setShowRequestModal(true); }}
      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm"
    >
      <UserPlus className="w-4 h-4" />
      Nova Solicitação
    </button>
  ) : null

  return (
    <PageLayout
      title="Moderação"
      subtitle="Gerencie suas associações de moderação"
      icon={Users}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      actions={headerActions}
    >
      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* My Users Tab (Moderator) */}
            {activeTab === 'users' && isModeratorOrAbove() && (
              <UserList 
                users={myUsers} 
                onRevolkSuccess={() => setRefreshKey(prev => prev + 1)}
              />
            )}
            
            {/* My Moderator Tab */}
            {activeTab === 'moderator' && (
              <ModeratorList 
                moderator={myModerator}
                associations={associations}
                onRequestNew={() => { setRenewAssociation(null); setShowRequestModal(true); }}
                onRenew={(association) => { setRenewAssociation(association); setShowRequestModal(true); }}
                onRevolkSuccess={() => setRefreshKey(prev => prev + 1)}
              />
            )}
            
            {/* Sent Requests Tab */}
            {activeTab === 'sent' && isModeratorOrAbove() && (
              <RequestList 
                requests={sentRequests} 
                type="sent" 
                onSelect={() => {}}
              />
            )}
            
            {/* Received Requests Tab */}
            {activeTab === 'received' && (
              <RequestList 
                requests={receivedRequests} 
                type="received" 
                onSelect={handleRequestClick}
              />
            )}
            
            {/* History Tab */}
            {activeTab === 'history' && (
              <ModerationHistory 
                requests={[...sentRequests, ...receivedRequests].filter(r => r.status !== 'PENDING')} 
              />
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
    </PageLayout>
  )
}

// ==========================================
// Sub-components definitions
// ==========================================

function UserList({ users, onRevolkSuccess }: { users: Array<{ user: UserSummary; association: ModerationAssociation }>, onRevolkSuccess: () => void }) {
  if (users.length === 0) {
    return (
      <EmptyState 
        icon={Users} 
        title="Nenhum usuário moderado" 
        description="Você ainda não modera nenhum usuário." 
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      {users.map(({ user, association }) => (
        <ModerationCard
          key={association.id}
          association={association}
          viewAs="moderator"
          onRevoked={onRevolkSuccess}
        />
      ))}
    </div>
  )
}

function ModeratorList({ 
  moderator, 
  associations, 
  onRequestNew, 
  onRenew,
  onRevolkSuccess
}: { 
  moderator: UserSummary | null, 
  associations: ModerationAssociation[], 
  onRequestNew: () => void, 
  onRenew: (a: ModerationAssociation) => void,
  onRevolkSuccess: () => void
}) {
  // Find active association for the moderator
  const activeAssociation = associations.find(a => 
    a.moderator_id === moderator?.id && a.is_active
  )

  if (!moderator || !activeAssociation) {
    return (
      <div className="text-center py-12">
        <div className="bg-orange-50 inline-flex p-4 rounded-full mb-4">
          <UserPlus className="w-8 h-8 text-orange-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem moderador definido</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Você precisa de um moderador para auxiliar nas suas atividades.
        </p>
        <button
          onClick={onRequestNew}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
        >
          Solicitar Moderador
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">Seu Moderador Atual</h3>
      <ModerationCard
        association={activeAssociation}
        viewAs="user"
        onRevoked={onRevolkSuccess}
        onRenew={onRenew}
      />
    </div>
  )
}

function RequestList({ requests, type, onSelect }: { requests: ModerationRequest[], type: 'sent' | 'received', onSelect: (r: ModerationRequest) => void }) {
  if (requests.length === 0) {
    return (
      <EmptyState 
        icon={type === 'sent' ? Send : Inbox} 
        title="Nenhuma solicitação" 
        description={type === 'sent' ? "Você não enviou nenhuma solicitação pendente." : "Não há solicitações pendentes para você."} 
      />
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(request => (
        <div 
          key={request.id}
          onClick={() => onSelect(request)}
          className={`bg-white border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${onSelect ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${type === 'received' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
              {type === 'received' ? <Inbox className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {type === 'received' 
                  ? `Solicitação de ${request.moderator_name}` 
                  : `Solicitação para ${request.user_name}`}
              </p>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(request.requested_at).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>{request.duration_label}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[request.status]}`}>
              {REQUEST_STATUS_LABELS[request.status]}
            </span>
            {type === 'received' && request.status === 'PENDING' && (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ModerationHistory({ requests }: { requests: ModerationRequest[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState 
        icon={History} 
        title="Histórico Vazio" 
        description="Nenhum registro de histórico encontrado." 
      />
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Envolvidos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.map(request => (
              <tr key={request.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(request.requested_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Solicitação de Moderação
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {request.moderator_name} ↔ {request.user_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${REQUEST_STATUS_COLORS[request.status]}`}>
                    {REQUEST_STATUS_LABELS[request.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-gray-50 p-4 rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 max-w-sm">{description}</p>
    </div>
  )
}
