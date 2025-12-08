import { Trash2 } from 'lucide-react'
import { FieldErrors } from 'react-hook-form'

interface CaseVariablesListProps {
  fields: any[]
  remove: (index: number) => void
  errors: FieldErrors<any>
  onOpenModal: () => void
}

export function CaseVariablesList({ fields, remove, errors, onOpenModal }: CaseVariablesListProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50 flex flex-col">
      <h3 className="text-sm font-bold text-gray-700 mb-4 border-l-4 border-orange-500 pl-2">Lista de variáveis</h3>
      
      {/* Scrollable content area with fixed max height */}
      <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] space-y-2 mb-4">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-10">Nenhuma variável adicionada. Adicione pelo menos uma.</p>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="bg-white p-3 rounded border flex justify-between items-center text-sm">
              <div>
                <span className="font-medium block">{field.variable_name}</span>
                <span className="text-xs text-gray-500">{field.product} - {field.variable_type}</span>
              </div>
              <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
      
      {errors.variables && <p className="text-xs text-red-500 mb-2">{errors.variables.message as string}</p>}

      {/* Sticky footer with action buttons - always visible */}
      <div className="sticky bottom-0 pt-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-4">
        <button
          type="button"
          onClick={onOpenModal}
          className="bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Adicionar Variáveis
        </button>
        <button
          type="submit"
          className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Criar Case
        </button>
      </div>
    </div>
  )
}
