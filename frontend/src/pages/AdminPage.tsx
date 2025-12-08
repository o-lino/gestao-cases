import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { UserManagement } from '@/components/admin/UserManagement'
import { Settings, Users, Shield, Database, Activity, Bell, Webhook } from 'lucide-react'

type AdminTab = 'users' | 'security' | 'system' | 'notifications' | 'webhooks'

export function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')

  // Check admin access
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    )
  }

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'system', label: 'Sistema', icon: Database },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">Gerencie configurações do sistema</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-card border rounded-lg p-6">
        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Configurações de Segurança</h2>
            
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Autenticação</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Exigir MFA para administradores</span>
                    <input type="checkbox" className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Bloqueio após falhas de login</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Tempo de expiração da sessão (minutos)</span>
                    <input type="number" defaultValue={60} className="w-20 px-2 py-1 border rounded" />
                  </label>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Rate Limiting</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Limite de requisições por minuto</span>
                    <input type="number" defaultValue={100} className="w-20 px-2 py-1 border rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Limite de login por minuto</span>
                    <input type="number" defaultValue={10} className="w-20 px-2 py-1 border rounded" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Configurações de Notificações</h2>
            
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Email</h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm text-muted-foreground">Provedor</span>
                    <select className="mt-1 w-full px-3 py-2 border rounded-lg">
                      <option>Mock (Desenvolvimento)</option>
                      <option>Amazon SES</option>
                      <option>SendGrid</option>
                      <option>SMTP</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Enviar email ao criar case</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Enviar email ao aprovar/rejeitar</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                Adicionar Webhook
              </button>
            </div>
            
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum webhook configurado</p>
              <p className="text-sm mt-1">Webhooks permitem notificar sistemas externos sobre eventos</p>
            </div>
          </div>
        )}
        
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Informações do Sistema</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm text-muted-foreground">Versão</h3>
                <p className="text-lg font-medium">v2.0.0</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm text-muted-foreground">Ambiente</h3>
                <p className="text-lg font-medium">Desenvolvimento</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm text-muted-foreground">Backend</h3>
                <p className="text-lg font-medium">FastAPI + Python 3.11</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm text-muted-foreground">Database</h3>
                <p className="text-lg font-medium">PostgreSQL 15</p>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-3">Ações de Manutenção</h3>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 border rounded-lg text-sm hover:bg-muted">
                  Limpar Cache
                </button>
                <button className="px-4 py-2 border rounded-lg text-sm hover:bg-muted">
                  Reindexar Busca
                </button>
                <button className="px-4 py-2 border rounded-lg text-sm hover:bg-muted">
                  Verificar Saúde
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
