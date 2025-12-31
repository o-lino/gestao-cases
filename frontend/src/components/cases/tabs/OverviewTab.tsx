/**
 * OverviewTab Component
 * Displays case details, context, impact, and system information
 */

import { Case } from '@/services/caseService'

interface OverviewTabProps {
  caseData: Case
}

export function OverviewTab({ caseData }: OverviewTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Detalhes do Projeto</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descrição</label>
              <p className="mt-1 text-sm">{caseData.description || 'Nenhuma descrição fornecida.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                <p className="mt-1 text-sm font-medium">{caseData.client_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Solicitante</label>
                <p className="mt-1 text-sm font-medium">{caseData.requester_email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Macro Case</label>
                <p className="mt-1 text-sm font-medium">{caseData.macro_case || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data de Uso Estimada</label>
                <p className="mt-1 text-sm font-medium">
                  {caseData.estimated_use_date ? new Date(caseData.estimated_use_date).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Contexto e Justificativa</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contexto</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.context || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Necessidade</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.necessity || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Impacto e Alcance</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Impacto Esperado</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.impact || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Jornada Impactada</label>
              <p className="mt-1 text-sm">{caseData.impacted_journey || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Segmento Impactado</label>
              <p className="mt-1 text-sm">{caseData.impacted_segment || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Clientes Impactados</label>
              <p className="mt-1 text-sm">{caseData.impacted_customers || '-'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Informações do Sistema</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Criado por</span>
              <span className="text-sm font-medium">Usuário {caseData.created_by}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Criado em</span>
              <span className="text-sm font-medium">{new Date(caseData.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Última atualização</span>
              <span className="text-sm font-medium">{new Date(caseData.updated_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
