/**
 * InvolvementSetDateModal Component
 * 
 * Modal for owner to set the expected completion date for an involvement.
 */

import React, { useState } from 'react';
import involvementService, { SetDateRequest, Involvement } from '../../services/involvementService';

interface InvolvementSetDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  involvement: Involvement;
  onSuccess?: () => void;
}

export const InvolvementSetDateModal: React.FC<InvolvementSetDateModalProps> = ({
  isOpen,
  onClose,
  involvement,
  onSuccess,
}) => {
  // Default to 2 weeks from now
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 14);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  const [expectedDate, setExpectedDate] = useState(defaultDateStr);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!expectedDate) {
      setError('Data esperada é obrigatória');
      return;
    }

    const selectedDate = new Date(expectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError('A data esperada não pode ser no passado');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: SetDateRequest = {
        expected_completion_date: expectedDate,
        notes: notes.trim() || undefined,
      };

      await involvementService.setDate(involvement.id, data);
      
      // Reset form
      setNotes('');
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao definir data');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Definir Prazo de Conclusão
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Informe a data esperada para a criação do dado.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Involvement info */}
            <div className="bg-yellow-50 p-3 rounded-lg space-y-1">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Variável:</span> {involvement.variableName}
              </p>
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Requisição:</span> {involvement.externalRequestNumber}
              </p>
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Solicitante:</span> {involvement.requesterName}
              </p>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-800">
                ⚠️ <span className="font-medium">Atenção:</span> Após esta data, você receberá notificações de cobrança diárias até que informe a conclusão.
              </p>
            </div>

            {/* Expected Date */}
            <div>
              <label htmlFor="expectedDate" className="block text-sm font-medium text-gray-700 mb-1">
                Data Esperada de Conclusão *
              </label>
              <input
                id="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
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
                rows={2}
                placeholder="Dependências, riscos, observações sobre o prazo..."
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
                  Salvando...
                </>
              ) : (
                'Confirmar Prazo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvolvementSetDateModal;
