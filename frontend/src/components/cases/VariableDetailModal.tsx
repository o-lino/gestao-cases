import { ExternalLink, X, Database, User, Folder, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VariableDetailModalProps {
  variable: {
    id: number
    variable_name: string
    variable_type: string
    concept?: string
    desired_lag?: string
    search_status: string
    match_count: number
    top_score?: number
    selected_table?: string
    selected_table_id?: number
    selected_table_domain?: string
    selected_table_owner_name?: string
    selected_table_description?: string
    selected_table_full_path?: string
    match_status?: string
    is_pending_owner: boolean
    is_pending_requester?: boolean  // Owner approved, waiting for requester
    is_approved: boolean
  }
  onClose: () => void
}


export function VariableDetailModal({ variable, onClose }: VariableDetailModalProps) {
  // Generate Atlan link from full_path (e.g., "datalake/silver/table_name")
  const atlanBaseUrl = 'https://atlan.example.com/asset' // TODO: Configure from env
  const atlanLink = variable.selected_table_full_path 
    ? `${atlanBaseUrl}/${variable.selected_table_full_path.replace(/\//g, '/')}`
    : null

  const getStatusBadge = () => {
    if (variable.search_status === 'PENDING') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
          <Clock className="h-3 w-3" />
          Aguardando busca
        </span>
      )
    }
    if (variable.search_status === 'SEARCHING') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          Buscando...
        </span>
      )
    }
    if (variable.is_approved) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
          <CheckCircle className="h-3 w-3" />
          Aprovada pelo Owner
        </span>
      )
    }
    if (variable.is_pending_owner) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
          <AlertCircle className="h-3 w-3" />
          Pendente aprovação do Owner
        </span>
      )
    }
    if (variable.match_count > 0) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
          <Database className="h-3 w-3" />
          {variable.match_count} match(es) encontrado(s)
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
        Sem correspondência
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{variable.variable_name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">
                  {variable.variable_type === 'text' && 'Texto'}
                  {variable.variable_type === 'number' && 'Número'}
                  {variable.variable_type === 'date' && 'Data'}
                  {variable.variable_type === 'boolean' && 'Booleano'}
                  {!['text', 'number', 'date', 'boolean'].includes(variable.variable_type) && variable.variable_type}
                </span>
                {getStatusBadge()}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Variable Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conceito/Descrição</label>
              <p className="mt-1 text-sm">{variable.concept || 'Não informado'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Defasagem Desejada</label>
              <p className="mt-1 text-sm">{variable.desired_lag || 'Não informado'}</p>
            </div>
          </div>

          {/* Workflow Status */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Status do Workflow
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Step 1: Busca */}
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                variable.search_status !== 'PENDING' ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  variable.search_status !== 'PENDING' ? "bg-green-500" : "bg-gray-400"
                )} />
                Busca
              </div>
              <div className="w-4 h-0.5 bg-gray-300" />
              
              {/* Step 2: Aprovação Owner */}
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                variable.is_pending_requester || variable.is_approved 
                  ? "bg-green-100 text-green-700" 
                  : variable.is_pending_owner 
                    ? "bg-yellow-100 text-yellow-700" 
                    : "bg-gray-200 text-gray-500"
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  variable.is_pending_requester || variable.is_approved 
                    ? "bg-green-500" 
                    : variable.is_pending_owner 
                      ? "bg-yellow-500" 
                      : "bg-gray-400"
                )} />
                {variable.is_pending_owner && !variable.is_pending_requester && !variable.is_approved 
                  ? "Ag. Owner" 
                  : "Owner"}
              </div>
              <div className="w-4 h-0.5 bg-gray-300" />
              
              {/* Step 3: Aprovação Solicitante */}
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                variable.is_approved 
                  ? "bg-green-100 text-green-700" 
                  : variable.is_pending_requester 
                    ? "bg-yellow-100 text-yellow-700" 
                    : "bg-gray-200 text-gray-500"
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  variable.is_approved 
                    ? "bg-green-500" 
                    : variable.is_pending_requester 
                      ? "bg-yellow-500" 
                      : "bg-gray-400"
                )} />
                {variable.is_pending_requester && !variable.is_approved 
                  ? "Ag. Solicitante" 
                  : "Solicitante"}
              </div>
              <div className="w-4 h-0.5 bg-gray-300" />
              
              {/* Step 4: Disponível */}
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                variable.is_approved ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  variable.is_approved ? "bg-green-500" : "bg-gray-400"
                )} />
                Disponível
              </div>
            </div>
          </div>

          {/* Suggested Table Section */}
          {variable.selected_table && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 border-b">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Tabela Sugerida
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-base">{variable.selected_table}</p>
                    {variable.selected_table_description && (
                      <p className="text-sm text-muted-foreground mt-1">{variable.selected_table_description}</p>
                    )}
                  </div>
                  {variable.top_score && (
                    <div className="text-right">
                      <span className="text-lg font-bold text-green-600">{Math.round(variable.top_score * 100)}%</span>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Domínio</p>
                      <p className="text-sm font-medium">{variable.selected_table_domain || 'Não informado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                      <p className="text-sm font-medium">{variable.selected_table_owner_name || 'Não informado'}</p>
                    </div>
                  </div>
                </div>

                {atlanLink && (
                  <div className="pt-3 border-t">
                    <a 
                      href={atlanLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver no Catálogo Atlan
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">{variable.selected_table_full_path}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Table Found */}
          {!variable.selected_table && variable.search_status !== 'PENDING' && (
            <div className="border rounded-lg p-6 text-center bg-gray-50">
              <Database className="h-10 w-10 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma tabela correspondente encontrada ainda.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
