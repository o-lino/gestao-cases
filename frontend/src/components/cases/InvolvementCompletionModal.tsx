/**
 * InvolvementCompletionModal Component
 * 
 * Modal for owner to complete an involvement by providing
 * the created table name and concept.
 */

import React, { useState } from 'react';
import involvementService, { CompleteInvolvementRequest, Involvement } from '../../services/involvementService';

interface InvolvementCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  involvement: Involvement;
  onSuccess?: () => void;
}

export const InvolvementCompletionModal: React.FC<InvolvementCompletionModalProps> = ({
  isOpen,
  onClose,
  involvement,
  onSuccess,
}) => {
  const [createdTableName, setCreatedTableName] = useState('');
  const [createdConcept, setCreatedConcept] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createdTableName.trim()) {
      setError('Nome da tabela é obrigatório');
      return;
    }
    
    if (!createdConcept.trim()) {
      setError('Conceito/descrição é obrigatório');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CompleteInvolvementRequest = {
        created_table_name: createdTableName.trim(),
        created_concept: createdConcept.trim(),
        notes: notes.trim() || undefined,
      };

      await involvementService.complete(involvement.id, data);
      
      // Reset form
      setCreatedTableName('');
      setCreatedConcept('');
      setNotes('');
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao concluir envolvimento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Concluir Envolvimento
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Informe os dados da tabela/conceito criado para a variável.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Involvement info */}
            <div className="bg-green-50 p-3 rounded-lg space-y-1">
              <p className="text-sm text-green-800">
                <span className="font-medium">Variável:</span> {involvement.variableName}
              </p>
              <p className="text-sm text-green-800">
                <span className="font-medium">Requisição:</span> {involvement.externalRequestNumber}
              </p>
              {involvement.isOverdue && (
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ Vencido há {involvement.daysOverdue} dia(s)
                </p>
              )}
            </div>

            {/* Created Table Name */}
            <div>
              <label htmlFor="tableName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Tabela Criada *
              </label>
              <input
                id="tableName"
                type="text"
                value={createdTableName}
                onChange={(e) => setCreatedTableName(e.target.value)}
                placeholder="Ex: datalake.gold.tb_vendas_cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Informe o caminho completo da tabela no data lake
              </p>
            </div>

            {/* Created Concept */}
            <div>
              <label htmlFor="concept" className="block text-sm font-medium text-gray-700 mb-1">
                Conceito / Descrição *
              </label>
              <textarea
                id="concept"
                value={createdConcept}
                onChange={(e) => setCreatedConcept(e.target.value)}
                rows={4}
                placeholder="Descreva o conteúdo da tabela, colunas principais, granularidade, periodicidade de atualização..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Observações Finais (opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais sobre a criação..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Salvando...
                </>
              ) : (
                <>
                  <span>✅</span>
                  Concluir Envolvimento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvolvementCompletionModal;
