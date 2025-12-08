import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { caseService, Case } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'

interface CloneCaseButtonProps {
  caseData: Case
  variant?: 'button' | 'icon'
}

export function CloneCaseButton({ caseData, variant = 'button' }: CloneCaseButtonProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [isCloning, setIsCloning] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [cloneOptions, setCloneOptions] = useState({
    includeVariables: true,
    includeDocuments: false,
    newTitle: `${caseData.title} (Cópia)`,
    resetStatus: true,
  })

  const handleClone = async () => {
    setIsCloning(true)
    
    try {
      // Prepare clone data
      const cloneData = {
        title: cloneOptions.newTitle,
        description: caseData.description,
        client_name: caseData.client_name,
        requester_email: caseData.requester_email,
        macro_case: caseData.macro_case,
        context: caseData.context,
        impact: caseData.impact,
        necessity: caseData.necessity,
        impacted_journey: caseData.impacted_journey,
        impacted_segment: caseData.impacted_segment,
        impacted_customers: caseData.impacted_customers,
        start_date: caseData.start_date,
        end_date: caseData.end_date,
        budget: caseData.budget,
        variables: cloneOptions.includeVariables ? caseData.variables : [],
      }

      // Create the cloned case
      const newCase = await caseService.create(cloneData)
      
      toast.success(`Case clonado com sucesso! Novo ID: ${newCase.id}`)
      setShowModal(false)
      
      // Navigate to the new case
      navigate(`/cases/${newCase.id}`)
    } catch (error: any) {
      console.error('Failed to clone case:', error)
      toast.error('Erro ao clonar case: ' + (error.response?.data?.detail || error.message))
    } finally {
      setIsCloning(false)
    }
  }

  const triggerButton = variant === 'icon' ? (
    <button
      onClick={() => setShowModal(true)}
      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
      title="Clonar Case"
    >
      <Copy className="h-4 w-4" />
    </button>
  ) : (
    <button
      onClick={() => setShowModal(true)}
      className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted"
    >
      <Copy className="h-4 w-4" />
      Clonar Case
    </button>
  )

  return (
    <>
      {triggerButton}

      {/* Clone Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clonar Case
            </h2>

            <div className="space-y-4">
              {/* New Title */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Título do novo case
                </label>
                <input
                  type="text"
                  value={cloneOptions.newTitle}
                  onChange={(e) => setCloneOptions(prev => ({ ...prev, newTitle: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cloneOptions.includeVariables}
                    onChange={(e) => setCloneOptions(prev => ({ 
                      ...prev, 
                      includeVariables: e.target.checked 
                    }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">Incluir variáveis ({caseData.variables?.length || 0})</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cloneOptions.resetStatus}
                    onChange={(e) => setCloneOptions(prev => ({ 
                      ...prev, 
                      resetStatus: e.target.checked 
                    }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">Iniciar como Rascunho</span>
                </label>

                <label className="flex items-center gap-2 opacity-50">
                  <input
                    type="checkbox"
                    checked={cloneOptions.includeDocuments}
                    onChange={(e) => setCloneOptions(prev => ({ 
                      ...prev, 
                      includeDocuments: e.target.checked 
                    }))}
                    className="h-4 w-4 rounded"
                    disabled
                  />
                  <span className="text-sm">Copiar documentos (em breve)</span>
                </label>
              </div>

              {/* Info */}
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  O novo case será criado como uma cópia independente. 
                  Alterações em um não afetam o outro.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleClone}
                disabled={isCloning || !cloneOptions.newTitle.trim()}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCloning ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Clonando...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Clonar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
