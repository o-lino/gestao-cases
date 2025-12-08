import { useState } from 'react'
import { 
  Check, X, MessageSquare, Database, User, AlertCircle, 
  ChevronDown, ExternalLink, RefreshCw 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchSuggestion {
  id: number
  table: {
    id: number
    name: string
    display_name?: string
    description?: string
    schema_name?: string
    table_name: string
    owner?: { full_name: string; email: string }
    columns?: Array<{ name: string; type: string; description?: string }>
  }
  score: number
  justification: string
  matched_columns?: string[]
  was_reused?: boolean
}

interface OwnerReviewPanelProps {
  match: MatchSuggestion
  variable: { id: number; name: string; value?: string; context?: string }
  onApprove: (comment: string) => void
  onReject: (comment: string, alternativeId?: number) => void
  onSkip?: () => void
  alternatives?: MatchSuggestion[]
}

export function OwnerReviewPanel({
  match,
  variable,
  onApprove,
  onReject,
  onSkip,
  alternatives = [],
}: OwnerReviewPanelProps) {
  const [comment, setComment] = useState('')
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [selectedAlternative, setSelectedAlternative] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    setIsSubmitting(true)
    await onApprove(comment)
    setIsSubmitting(false)
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    await onReject(comment, selectedAlternative || undefined)
    setIsSubmitting(false)
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-orange-500/10 border-b border-orange-500/20 px-6 py-4">
        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <User className="h-5 w-5" />
          <span className="font-semibold">Validação do Data Owner</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Você é o responsável por esta tabela. Valide se ela atende à necessidade abaixo.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Variable Request */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Variável Solicitada</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{variable.name}</span>
            </div>
            {variable.value && (
              <p className="text-sm">Valor/Descrição: {variable.value}</p>
            )}
            {variable.context && (
              <p className="text-sm text-muted-foreground">Contexto: {variable.context}</p>
            )}
          </div>
        </div>

        {/* Suggested Table */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Tabela Sugerida
            </h4>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                match.score >= 0.8 ? "bg-green-100 text-green-700" :
                match.score >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {Math.round(match.score * 100)}% relevância
              </span>
              {match.was_reused && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Reúso
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <span className="font-semibold">{match.table.display_name || match.table.name}</span>
              <span className="text-xs font-mono text-muted-foreground ml-2">
                {match.table.schema_name}.{match.table.table_name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{match.table.description}</p>
            
            {/* Matched Columns */}
            {match.matched_columns && match.matched_columns.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-1">Colunas correspondentes:</p>
                <div className="flex flex-wrap gap-1">
                  {match.matched_columns.map(col => (
                    <span key={col} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="mt-3 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium mb-1">Por que esta tabela?</p>
              <p className="text-sm text-muted-foreground">{match.justification}</p>
            </div>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <MessageSquare className="h-4 w-4 inline mr-1" />
            Comentário (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Adicione observações, ressalvas ou instruções..."
            className="w-full px-3 py-2 border rounded-lg resize-none"
            rows={3}
          />
        </div>

        {/* Suggest Alternative */}
        {alternatives.length > 0 && (
          <div>
            <button
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAlternatives && "rotate-180")} />
              Sugerir tabela alternativa
            </button>
            
            {showAlternatives && (
              <div className="mt-2 space-y-2">
                {alternatives.map(alt => (
                  <button
                    key={alt.id}
                    onClick={() => setSelectedAlternative(alt.id)}
                    className={cn(
                      "w-full text-left p-3 border rounded-lg",
                      selectedAlternative === alt.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{alt.table.display_name || alt.table.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(alt.score * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{alt.table.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
            Rejeitar Match
          </button>
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            <Check className="h-5 w-5" />
            Aprovar Match
          </button>
        </div>
      </div>
    </div>
  )
}

// Requester Review Panel (similar but for the requester)
interface RequesterReviewPanelProps {
  match: MatchSuggestion
  variable: { id: number; name: string; value?: string }
  ownerComment?: string
  onConfirm: (comment: string) => void
  onRequestAlternative: (comment: string) => void
}

export function RequesterReviewPanel({
  match,
  variable,
  ownerComment,
  onConfirm,
  onRequestAlternative,
}: RequesterReviewPanelProps) {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-green-500/10 border-b border-green-500/20 px-6 py-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="h-5 w-5" />
          <span className="font-semibold">Dado Aprovado pelo Owner</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          O dono da tabela aprovou este match. Confirme se atende sua necessidade.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Owner Comment */}
        {ownerComment && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
              Comentário do Data Owner:
            </p>
            <p className="text-sm">{ownerComment}</p>
          </div>
        )}

        {/* Variable */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Sua Solicitação</h4>
          <p className="font-semibold">{variable.name}</p>
          {variable.value && <p className="text-sm text-muted-foreground">{variable.value}</p>}
        </div>

        {/* Table Info */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <Database className="h-4 w-4" />
            Tabela Disponibilizada
          </h4>
          <div className="space-y-2">
            <p className="font-semibold">{match.table.display_name || match.table.name}</p>
            <p className="text-sm text-muted-foreground">{match.table.description}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {match.table.schema_name}.{match.table.table_name}
            </p>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium mb-2">Feedback (opcional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Se precisar de outro dado, explique aqui..."
            className="w-full px-3 py-2 border rounded-lg resize-none"
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => onRequestAlternative(comment)}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
            Buscar Alternativa
          </button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-5 w-5" />
            Confirmar Dado
          </button>
        </div>
      </div>
    </div>
  )
}
