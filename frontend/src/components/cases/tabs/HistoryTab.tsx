/**
 * HistoryTab Component
 * Displays the timeline of case history events
 */

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { caseService } from '@/services/caseService'
import { HistoryEvent } from '@/types'

interface HistoryTabProps {
  caseId: number
}

interface ActionInfo {
  label: string
  color: string
  description: string
}

// Type for change details
interface ChangeDetail {
  old?: string | number | boolean
  new?: string | number | boolean
}

export function HistoryTab({ caseId }: HistoryTabProps) {
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [caseId])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await caseService.getHistory(caseId)
      setHistory(data)
    } catch (error) {
      console.error('Failed to load history', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando histórico...</div>
      </div>
    )
  }

  // Helper function to get action description and icon color
  // Using Itaú Unibanco color palette: orange, blue, gray, green, amber (gold)
  const getActionInfo = (event: HistoryEvent): ActionInfo => {
    const changes = event.details as Record<string, ChangeDetail | string> | undefined
    const actionMap: Record<string, ActionInfo> = {
      'CREATE': { label: 'Case Criado', color: 'bg-green-600', description: String(changes?.action || 'Case foi criado') },
      'UPDATE': { label: 'Atualização', color: 'bg-blue-600', description: 'Dados do case foram atualizados' },
      'TRANSITION': { 
        label: 'Mudança de Status', 
        color: 'bg-amber-500', 
        description: `Status alterado de ${event.old_status || '?'} para ${event.new_status || '?'}` 
      },
      'ADD_VARIABLE': { 
        label: 'Variável Adicionada', 
        color: 'bg-orange-500', 
        description: changes?.variable_name ? `Variável "${changes.variable_name}" adicionada` : 'Nova variável adicionada' 
      },
      'CANCEL_VARIABLE': { 
        label: 'Variável Cancelada', 
        color: 'bg-gray-600', 
        description: changes?.variable_name ? `Variável "${changes.variable_name}" cancelada` : 'Variável cancelada' 
      },
      'DELETE_VARIABLE': { 
        label: 'Variável Excluída', 
        color: 'bg-gray-800', 
        description: changes?.variable_name ? `Variável "${changes.variable_name}" excluída permanentemente` : 'Variável excluída' 
      },
      'CANCEL': { 
        label: 'Case Cancelado', 
        color: 'bg-gray-700', 
        description: changes?.reason ? `Case cancelado: ${changes.reason}` : 'Case foi cancelado' 
      },
    }
    return actionMap[event.action] || { label: event.action, color: 'bg-gray-500', description: 'Ação registrada' }
  }

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum histórico disponível.</div>
          ) : (
            history.map((event, eventIdx) => {
              const actionInfo = getActionInfo(event)
              const changes = event.details as Record<string, ChangeDetail | string> | undefined
              return (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {eventIdx !== history.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full ${actionInfo.color} flex items-center justify-center ring-8 ring-white`}>
                          <Clock className="h-4 w-4 text-white" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${actionInfo.color} text-white`}>
                              {actionInfo.label}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              por {event.actor_name || 'Usuário'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {actionInfo.description}
                          </p>
                          {/* Show detailed changes for UPDATE actions */}
                          {event.action === 'UPDATE' && changes && Object.keys(changes).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              {Object.entries(changes).map(([field, change]) => {
                                if (typeof change === 'object' && change !== null) {
                                  return (
                                    <div key={field}>
                                      <strong>{field}:</strong> {String(change.old)} → {String(change.new)}
                                    </div>
                                  )
                                }
                                return null
                              })}
                            </div>
                          )}
                          {/* Show additional details for variable operations */}
                          {(event.action === 'ADD_VARIABLE' || event.action === 'CANCEL_VARIABLE') && changes && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              {changes.variable_type && <div><strong>Tipo:</strong> {String(changes.variable_type)}</div>}
                              {changes.product && changes.product !== 'N/A' && <div><strong>Produto:</strong> {String(changes.product)}</div>}
                              {changes.priority && changes.priority !== 'N/A' && <div><strong>Prioridade:</strong> {String(changes.priority)}</div>}
                              {changes.reason && changes.reason !== 'Não informado' && <div><strong>Motivo:</strong> {String(changes.reason)}</div>}
                            </div>
                          )}
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('pt-BR')}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
