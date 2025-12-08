import { useState } from 'react'
import { 
  Search, Database, Check, ChevronRight, RefreshCw, 
  Zap, ArrowRight, Star, ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchResult {
  id: number
  table: {
    id: number
    name: string
    display_name?: string
    description?: string
    schema_name?: string
    table_name: string
    owner?: { full_name: string; email: string }
    columns_count?: number
  }
  score: number
  justification: string
  matched_columns?: string[]
  was_reused?: boolean
}

interface MatchSelectorProps {
  variableName: string
  results: MatchResult[]
  onSelect: (matchId: number) => void
  onSearchMore?: () => void
  isSearching?: boolean
  reuseSuggestion?: MatchResult
}

export function MatchSelector({
  variableName,
  results,
  onSelect,
  onSearchMore,
  isSearching = false,
  reuseSuggestion,
}: MatchSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const handleConfirmSelection = () => {
    if (selectedId) {
      onSelect(selectedId)
    }
  }

  if (isSearching) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <Search className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Buscando dados no catálogo...</h3>
        <p className="text-muted-foreground">
          Analisando tabelas relevantes para "<span className="font-medium">{variableName}</span>"
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="font-semibold text-lg mb-2">Nenhum match encontrado</h3>
        <p className="text-muted-foreground mb-4">
          Não encontramos tabelas correspondentes para esta variável.
        </p>
        {onSearchMore && (
          <button
            onClick={onSearchMore}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            {results.length} tabela(s) encontrada(s)
          </h3>
          <p className="text-sm text-muted-foreground">
            Selecione a melhor opção para "{variableName}"
          </p>
        </div>
        {onSearchMore && (
          <button
            onClick={onSearchMore}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Buscar mais
          </button>
        )}
      </div>

      {/* Reuse Suggestion */}
      {reuseSuggestion && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Sugestão de Reúso</span>
          </div>
          <p className="text-sm">
            Esta tabela foi usada anteriormente para variáveis similares:
          </p>
          <button
            onClick={() => setSelectedId(reuseSuggestion.id)}
            className={cn(
              "mt-2 w-full text-left p-3 border rounded-lg",
              selectedId === reuseSuggestion.id 
                ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30"
                : "hover:bg-muted/50"
            )}
          >
            <span className="font-medium">{reuseSuggestion.table.display_name || reuseSuggestion.table.name}</span>
          </button>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={result.id}
            className={cn(
              "border rounded-lg overflow-hidden transition-all",
              selectedId === result.id && "ring-2 ring-primary"
            )}
          >
            {/* Card Header */}
            <div
              onClick={() => setSelectedId(result.id)}
              className={cn(
                "flex items-center gap-4 p-4 cursor-pointer",
                selectedId === result.id ? "bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              {/* Rank */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                index === 0 ? "bg-yellow-500 text-white" :
                index === 1 ? "bg-gray-400 text-white" :
                "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">
                    {result.table.display_name || result.table.name}
                  </span>
                  {result.was_reused && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Reúso
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {result.table.description}
                </p>
              </div>

              {/* Score */}
              <div className={cn(
                "text-sm font-semibold px-3 py-1 rounded-full shrink-0",
                result.score >= 0.8 ? "bg-green-100 text-green-700" :
                result.score >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {Math.round(result.score * 100)}%
              </div>

              {/* Expand Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedId(expandedId === result.id ? null : result.id)
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <ChevronRight className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  expandedId === result.id && "rotate-90"
                )} />
              </button>
            </div>

            {/* Expanded Details */}
            {expandedId === result.id && (
              <div className="border-t p-4 bg-muted/30 space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Localização</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {result.table.schema_name}.{result.table.table_name}
                  </p>
                </div>

                {result.table.owner && (
                  <div>
                    <p className="text-sm font-medium mb-1">Data Owner</p>
                    <p className="text-sm">{result.table.owner.full_name}</p>
                    <p className="text-xs text-muted-foreground">{result.table.owner.email}</p>
                  </div>
                )}

                {result.matched_columns && result.matched_columns.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Colunas Correspondentes</p>
                    <div className="flex flex-wrap gap-1">
                      {result.matched_columns.map(col => (
                        <span key={col} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-1">Justificativa</p>
                  <p className="text-sm text-muted-foreground">{result.justification}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirm Selection */}
      {selectedId && (
        <div className="sticky bottom-0 bg-background border-t pt-4">
          <button
            onClick={handleConfirmSelection}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-lg font-medium hover:bg-primary/90"
          >
            <ArrowRight className="h-5 w-5" />
            Enviar para Validação do Owner
          </button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            O dono da tabela receberá uma notificação para validar este match
          </p>
        </div>
      )}
    </div>
  )
}
