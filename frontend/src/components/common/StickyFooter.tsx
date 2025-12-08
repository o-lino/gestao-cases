import { CheckCircle, Plus } from 'lucide-react'

interface StickyFooterProps {
  onAddVariable: () => void
  onSubmit: () => void // This might be used if we need manual triggering, but type="submit" usually handles it
  isSubmitting: boolean
}

export function StickyFooter({ onAddVariable, onSubmit, isSubmitting }: StickyFooterProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 p-4 animate-slide-up">
      <div className="flex gap-3 max-w-7xl mx-auto">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onAddVariable()
          }}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 px-4 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors text-gray-700"
        >
          <Plus className="w-5 h-5" />
          Adicionar Variáveis
        </button>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Criando...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Criar Case
            </>
          )}
        </button>
      </div>
    </div>
  )
}
