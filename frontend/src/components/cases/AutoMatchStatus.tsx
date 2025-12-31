import { useState, useEffect } from 'react'
import { Zap, Loader2, Check, AlertCircle, Search, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VariableStatusBadge, VariableStatus } from './VariableWorkflow'

interface AutoMatchStatusProps {
  variableId: number
  variableName: string
  status: VariableStatus
  matchCount?: number
  topScore?: number
  isProcessing?: boolean
  onTriggerSearch?: () => void
  onViewMatches?: () => void
}

export function AutoMatchStatus({
  variableId: _variableId,
  variableName,
  status,
  matchCount = 0,
  topScore,
  isProcessing = false,
  onTriggerSearch,
  onViewMatches,
}: AutoMatchStatusProps) {
  
  const getStatusDisplay = () => {
    if (isProcessing) {
      return {
        icon: Loader2,
        iconClass: 'animate-spin text-blue-500',
        bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        message: 'Buscando dados no catálogo...',
      }
    }
    
    switch (status) {
      case 'PENDING':
        return {
          icon: Search,
          iconClass: 'text-gray-500',
          bgClass: 'bg-muted border-border',
          message: 'Aguardando busca automática',
        }
      case 'SEARCHING':
        return {
          icon: Loader2,
          iconClass: 'animate-spin text-blue-500',
          bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          message: 'Analisando catálogo...',
        }
      case 'MATCHED':
        return {
          icon: Check,
          iconClass: 'text-green-500',
          bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          message: `${matchCount} tabela(s) encontrada(s)`,
        }
      case 'NO_MATCH':
        return {
          icon: AlertCircle,
          iconClass: 'text-orange-500',
          bgClass: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
          message: 'Nenhuma correspondência encontrada',
        }
      case 'APPROVED':
        return {
          icon: Check,
          iconClass: 'text-green-500',
          bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          message: 'Dado confirmado',
        }
      default:
        return {
          icon: Zap,
          iconClass: 'text-yellow-500',
          bgClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          message: 'Em processamento...',
        }
    }
  }

  const display = getStatusDisplay()
  const Icon = display.icon

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      display.bgClass
    )}>
      <Icon className={cn("h-5 w-5 shrink-0", display.iconClass)} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{variableName}</span>
          <VariableStatusBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground">{display.message}</p>
      </div>

      {/* Score indicator */}
      {topScore !== undefined && matchCount > 0 && (
        <div className="text-right">
          <p className={cn(
            "text-lg font-bold",
            topScore >= 0.7 ? "text-green-600" :
            topScore >= 0.5 ? "text-yellow-600" :
            "text-red-600"
          )}>
            {Math.round(topScore * 100)}%
          </p>
          <p className="text-xs text-muted-foreground">melhor match</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status === 'PENDING' && onTriggerSearch && (
          <button
            onClick={onTriggerSearch}
            disabled={isProcessing}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Buscar
          </button>
        )}
        
        {status === 'NO_MATCH' && onTriggerSearch && (
          <button
            onClick={onTriggerSearch}
            disabled={isProcessing}
            className="flex items-center gap-1 px-3 py-1.5 border text-sm rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        )}
        
        {matchCount > 0 && onViewMatches && (
          <button
            onClick={onViewMatches}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90"
          >
            Ver matches
          </button>
        )}
      </div>
    </div>
  )
}

// Compact inline version for table rows
interface AutoMatchBadgeProps {
  status: VariableStatus
  matchCount?: number
  topScore?: number
  compact?: boolean
}

export function AutoMatchBadge({ 
  status, 
  matchCount = 0, 
  topScore,
  compact = false 
}: AutoMatchBadgeProps) {
  if (status === 'SEARCHING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Buscando...
      </span>
    )
  }

  if (status === 'MATCHED' && matchCount > 0) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
        topScore && topScore >= 0.7 
          ? "bg-green-100 text-green-700" 
          : "bg-yellow-100 text-yellow-700"
      )}>
        <Zap className="h-3 w-3" />
        {matchCount} match{matchCount > 1 ? 'es' : ''}
        {topScore && !compact && ` (${Math.round(topScore * 100)}%)`}
      </span>
    )
  }

  if (status === 'NO_MATCH') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-orange-600">
        <AlertCircle className="h-3 w-3" />
        Sem match
      </span>
    )
  }

  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <Check className="h-3 w-3" />
        Aprovado
      </span>
    )
  }

  return (
    <span className="text-xs text-muted-foreground">
      Pendente
    </span>
  )
}
