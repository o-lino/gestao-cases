/**
 * InvolvementRequestModal Component
 * 
 * Modal for requester to create an involvement request
 * after owner rejects a match saying data doesn't exist.
 */

import React, { useState } from 'react';
import involvementService, { CreateInvolvementRequest } from '../../services/involvementService';

interface InvolvementRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  variableId: number;
  variableName: string;
  onSuccess?: () => void;
}

export const InvolvementRequestModal: React.FC<InvolvementRequestModalProps> = ({
  isOpen,
  onClose,
  variableId,
  variableName,
  onSuccess,
}) => {
  const [externalRequestNumber, setExternalRequestNumber] = useState('');
  const [externalSystem, setExternalSystem] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!externalRequestNumber.trim()) {
      setError('Número da requisição é obrigatório');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateInvolvementRequest = {
        case_variable_id: variableId,
        external_request_number: externalRequestNumber.trim(),
        external_system: externalSystem.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await involvementService.create(data);
      
      // Reset form
      setExternalRequestNumber('');
      setExternalSystem('');
      setNotes('');
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao criar envolvimento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Abrir Envolvimento
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Registre o número da requisição aberta no sistema externo para a criação do dado.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Variable info */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Variável:</span> {variableName}
              </p>
            </div>

            {/* External Request Number */}
            <div>
              <label htmlFor="requestNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Número da Requisição *
              </label>
              <input
                id="requestNumber"
                type="text"
                value={externalRequestNumber}
                onChange={(e) => setExternalRequestNumber(e.target.value)}
                placeholder="Ex: INC0012345, JIRA-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* External System */}
            <div>
              <label htmlFor="externalSystem" className="block text-sm font-medium text-gray-700 mb-1">
                Sistema Externo (opcional)
              </label>
              <select
                id="externalSystem"
                value={externalSystem}
                onChange={(e) => setExternalSystem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                <option value="ServiceNow">ServiceNow</option>
                <option value="Jira">Jira</option>
                <option value="ITSM">ITSM</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Observações (opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informações adicionais sobre a requisição..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Enviando...
                </>
              ) : (
                'Criar Envolvimento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvolvementRequestModal;
