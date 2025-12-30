import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Settings, Shield, Database, Bell, Webhook, Users, Sliders } from 'lucide-react'
import { HierarchyManager } from '@/components/admin/HierarchyManager'
import { SystemConfigPanel } from '@/components/admin/SystemConfigPanel'
import { NotificationSettings } from '@/components/admin/NotificationSettings'
import { PageLayout, PageTab } from '@/components/common/PageLayout'

type AdminTab = 'hierarchy' | 'config' | 'security' | 'notifications' | 'webhooks' | 'system'

export function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('hierarchy')

  // Check admin access
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center bg-gray-50 min-h-screen flex flex-col items-center justify-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    )
  }

  const tabs: PageTab[] = [
    { id: 'hierarchy', label: 'Hierarquia', icon: Users },
    { id: 'config', label: 'Configurações', icon: Sliders },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'system', label: 'Sistema', icon: Database },
  ]

  return (
    <PageLayout
      title="Administração do Sistema"
      subtitle="Configure hierarquia, aprovações, segurança e integrações"
      icon={Settings}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as AdminTab)}
    >
      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'hierarchy' && (
          <HierarchyManager />
        )}

        {activeTab === 'config' && (
          <SystemConfigPanel />
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Configurações de Segurança</h2>
            
            <div className="grid gap-4">
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="font-medium text-foreground mb-2">Autenticação</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-600">Exigir MFA para administradores</span>
                    <input type="checkbox" className="h-4 w-4 accent-orange-500" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-600">Bloqueio após falhas de login</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-orange-500" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tempo de expiração da sessão (minutos)</span>
                    <input type="number" defaultValue={60} className="w-20 px-2 py-1 border border-gray-300 rounded bg-white text-foreground focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all" />
                  </label>
                </div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="font-medium text-foreground mb-2">Rate Limiting</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Limite de requisições por minuto</span>
                    <input type="number" defaultValue={100} className="w-20 px-2 py-1 border border-gray-300 rounded bg-white text-foreground focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Limite de login por minuto</span>
                    <input type="number" defaultValue={10} className="w-20 px-2 py-1 border border-gray-300 rounded bg-white text-foreground focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <NotificationSettings />
        )}
        
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Webhooks</h2>
              <button className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-colors shadow-sm">
                Adicionar Webhook
              </button>
            </div>
            
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-300" />
              <p className="text-gray-500 font-medium">Nenhum webhook configurado</p>
              <p className="text-sm mt-1 text-gray-400">Webhooks permitem notificar sistemas externos sobre eventos</p>
            </div>
          </div>
        )}
        
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Informações do Sistema</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="text-sm text-gray-500">Versão</h3>
                <p className="text-lg font-medium text-foreground">v2.0.0</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="text-sm text-gray-500">Ambiente</h3>
                <p className="text-lg font-medium text-foreground">Desenvolvimento</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="text-sm text-gray-500">Backend</h3>
                <p className="text-lg font-medium text-foreground">FastAPI + Python 3.11</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <h3 className="text-sm text-gray-500">Database</h3>
                <p className="text-lg font-medium text-foreground">PostgreSQL 15</p>
              </div>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
              <h3 className="font-medium text-foreground mb-3">Ações de Manutenção</h3>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
                  Limpar Cache
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
                  Reindexar Busca
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
                  Verificar Saúde
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
