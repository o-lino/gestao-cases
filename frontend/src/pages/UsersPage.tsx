import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { UserManagement } from '@/components/admin/UserManagement'
import { Users, Shield, Activity, UserCheck, Database } from 'lucide-react'
import { PageLayout, PageTab } from '@/components/common/PageLayout'

type UsersTab = 'users' | 'roles' | 'activity' | 'moderators'

export function UsersPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<UsersTab>('users')

  // Check admin access
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center bg-gray-50 min-h-screen flex flex-col items-center justify-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    )
  }

  const tabs: PageTab[] = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'roles', label: 'Funções', icon: Shield },
    { id: 'activity', label: 'Atividade', icon: Activity },
    { id: 'moderators', label: 'Moderadores', icon: UserCheck },
  ]

  return (
    <PageLayout
      title="Gestão de Usuários"
      subtitle="Gerencie usuários, funções e permissões"
      icon={Users}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as UsersTab)}
    >
      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Gestão de Funções</h2>
            
            <div className="grid gap-4">
              {/* Admin Role */}
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Administrador</h3>
                    <p className="text-sm text-muted-foreground">Acesso total ao sistema</p>
                  </div>
                </div>
                <div className="ml-12 space-y-1 text-sm text-muted-foreground">
                  <p>• Gerenciar usuários e permissões</p>
                  <p>• Configurar sistema</p>
                  <p>• Aprovar/rejeitar cases</p>
                  <p>• Acessar todas as funcionalidades</p>
                </div>
              </div>

              {/* Moderator Role */}
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Moderador</h3>
                    <p className="text-sm text-muted-foreground">Revisão e aprovação de cases</p>
                  </div>
                </div>
                <div className="ml-12 space-y-1 text-sm text-muted-foreground">
                  <p>• Aprovar/rejeitar cases dos seus usuários</p>
                  <p>• Visualizar pendências de moderação</p>
                  <p>• Gerenciar associações de moderação</p>
                </div>
              </div>

              {/* Curator Role */}
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Curador</h3>
                    <p className="text-sm text-muted-foreground">Gestão e qualidade de dados</p>
                  </div>
                </div>
                <div className="ml-12 space-y-1 text-sm text-muted-foreground">
                  <p>• Corrigir sugestões da IA</p>
                  <p>• Validar metadados e tabelas</p>
                  <p>• Gerenciar dicionário de dados</p>
                </div>
              </div>

              {/* User Role */}
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Usuário</h3>
                    <p className="text-sm text-muted-foreground">Acesso básico ao sistema</p>
                  </div>
                </div>
                <div className="ml-12 space-y-1 text-sm text-muted-foreground">
                  <p>• Criar e gerenciar seus próprios cases</p>
                  <p>• Visualizar dashboard pessoal</p>
                  <p>• Configurar preferências</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Log de Atividades</h2>
            
            <div className="space-y-3">
              {/* Activity Log Items */}
              {[
                { user: 'Admin User', action: 'Login realizado', time: 'Há 5 minutos', type: 'info' },
                { user: 'Manager User', action: 'Case #123 criado', time: 'Há 15 minutos', type: 'success' },
                { user: 'Admin User', action: 'Usuário Regular User editado', time: 'Há 1 hora', type: 'warning' },
                { user: 'Manager User', action: 'Case #122 aprovado', time: 'Há 2 horas', type: 'success' },
                { user: 'Regular User', action: 'Login realizado', time: 'Há 3 horas', type: 'info' },
                { user: 'Admin User', action: 'Configurações do sistema alteradas', time: 'Há 1 dia', type: 'warning' },
              ].map((log, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 mt-2 rounded-full ${
                    log.type === 'success' ? 'bg-green-500' :
                    log.type === 'warning' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{log.user}</span>
                      {' - '}
                      {log.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <button className="text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium">
                Carregar mais atividades
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'moderators' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Associações de Moderação</h2>
              <button className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm">
                Nova Associação
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Moderador</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Usuário</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">Manager User</td>
                    <td className="px-4 py-3 text-sm text-foreground">Regular User</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">01/12/2026</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">Manager User</td>
                    <td className="px-4 py-3 text-sm text-foreground">Inactive User</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Inativo</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">15/11/2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
