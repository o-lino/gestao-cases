/**
 * InvolvementCard Component
 * 
 * Displays involvement status on a variable card with visual indicators
 * for pending, in-progress, overdue, and completed states.
 */

import React from 'react';
import { Involvement, InvolvementStatus } from '../../services/involvementService';

interface InvolvementCardProps {
  involvement: Involvement;
  onSetDate?: () => void;
  onComplete?: () => void;
  isOwner?: boolean;
}

const statusConfig: Record<InvolvementStatus, { 
  label: string; 
  bgColor: string; 
  textColor: string;
  icon: string;
}> = {
  PENDING: {
    label: 'Aguardando Data',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '⏳',
  },
  IN_PROGRESS: {
    label: 'Em Andamento',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: '🔄',
  },
  OVERDUE: {
    label: 'Vencido',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '⚠️',
  },
  COMPLETED: {
    label: 'Concluído',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: '✅',
  },
};

export const InvolvementCard: React.FC<InvolvementCardProps> = ({
  involvement,
  onSetDate,
  onComplete,
  isOwner = false,
}) => {
  const config = statusConfig[involvement.status];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.textColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-semibold">Envolvimento</span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor} border`}>
          {config.label}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="opacity-75">Requisição:</span>
          <span className="font-medium">{involvement.externalRequestNumber}</span>
        </div>
        
        {involvement.externalSystem && (
          <div className="flex justify-between">
            <span className="opacity-75">Sistema:</span>
            <span>{involvement.externalSystem}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="opacity-75">Responsável:</span>
          <span>{involvement.ownerName || 'Não atribuído'}</span>
        </div>

        {involvement.expectedCompletionDate && (
          <div className="flex justify-between">
            <span className="opacity-75">Prazo:</span>
            <span className={involvement.isOverdue ? 'text-red-600 font-bold' : ''}>
              {formatDate(involvement.expectedCompletionDate)}
              {involvement.isOverdue && ` (${involvement.daysOverdue}d atraso)`}
              {!involvement.isOverdue && involvement.daysUntilDue > 0 && ` (${involvement.daysUntilDue}d)`}
            </span>
          </div>
        )}

        {involvement.createdTableName && (
          <div className="flex justify-between">
            <span className="opacity-75">Tabela Criada:</span>
            <span className="font-mono text-xs">{involvement.createdTableName}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isOwner && involvement.status !== 'COMPLETED' && (
        <div className="mt-4 flex gap-2">
          {involvement.status === 'PENDING' && onSetDate && (
            <button
              onClick={onSetDate}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Definir Prazo
            </button>
          )}
          
          {(involvement.status === 'IN_PROGRESS' || involvement.status === 'OVERDUE') && onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
            >
              Informar Conclusão
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      {involvement.notes && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <p className="text-xs opacity-75 italic">{involvement.notes}</p>
        </div>
      )}
    </div>
  );
};

export default InvolvementCard;
