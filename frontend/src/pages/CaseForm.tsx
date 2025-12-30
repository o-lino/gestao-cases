import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { caseService } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { CaseFormHeader } from '@/components/cases/CaseFormHeader'
import { CaseFormDetails } from '@/components/cases/CaseFormDetails'
import { CaseVariablesList } from '@/components/cases/CaseVariablesList'
import { VariableWizard } from '@/components/cases/VariableWizard'
import { ExcelImportModal } from '@/components/cases/ExcelImportModal'
import { useToast } from '@/components/common/Toast'
import { StickyFooter } from '@/components/common/StickyFooter'

// Helper for text normalization
const normalizeText = (text: string) => {
  return text.trim().replace(/\s+/g, ' ')
}

const variableSchema = z.object({
  variable_name: z.string().min(3, 'Nome da variável deve ter no mínimo 3 caracteres'),
  variable_type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  variable_value: z.string().optional(),
  product: z.string().min(1, 'Produto é obrigatório'),
  concept: z.string().min(10, 'Conceito deve ter no mínimo 10 caracteres'),
  min_history: z.string().min(1, 'Histórico mínimo é obrigatório'),
  priority: z.string().min(1, 'Prioridade é obrigatória'),
  desired_lag: z.string().min(1, 'Defasagem é obrigatória'),
  options: z.string().optional(),
})

const caseSchema = z.object({
  title: z.string().min(5, 'Nome do Subcase deve ter no mínimo 5 caracteres'),
  client_name: z.string().min(3, 'Cliente deve ter no mínimo 3 caracteres'),
  requester_email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  macro_case: z.string().min(3, 'Macro Case deve ter no mínimo 3 caracteres'),
  context: z.string().min(20, 'Contexto deve ser detalhado (mínimo 20 caracteres)'),
  impact: z.string().min(10, 'Impacto deve ser detalhado (mínimo 10 caracteres)'),
  necessity: z.string().min(10, 'Necessidade deve ser detalhada (mínimo 10 caracteres)'),
  impacted_journey: z.string().min(5, 'Jornada impactada deve ter no mínimo 5 caracteres'),
  impacted_segment: z.string().min(5, 'Segmento impactado deve ter no mínimo 5 caracteres'),
  impacted_customers: z.string().min(1, 'Clientes impactados é obrigatório'),
  estimated_use_date: z.string().optional(),
  variables: z.array(variableSchema).min(1, 'É necessário adicionar pelo menos uma variável'),
})

type CaseFormValues = z.infer<typeof caseSchema>

export function CaseForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [formDataToSubmit, setFormDataToSubmit] = useState<CaseFormValues | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false)
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false)
  
  // Mock data for autocomplete
  const existingMacroCases = [
    { value: 'Otimização de Processos', label: 'Otimização de Processos' },
    { value: 'Expansão de Mercado', label: 'Expansão de Mercado' },
    { value: 'Redução de Custos', label: 'Redução de Custos' },
    { value: 'Transformação Digital', label: 'Transformação Digital' }
  ]
  const existingClients = [
    { value: 'Empresa ABC', label: 'Empresa ABC' },
    { value: 'Tech Solutions', label: 'Tech Solutions' },
    { value: 'Global Retail', label: 'Global Retail' },
    { value: 'Finance Corp', label: 'Finance Corp' }
  ]

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      title: '',
      client_name: '',
      requester_email: user?.email || '',
      macro_case: '',
      context: '',
      impact: '',
      necessity: '',
      impacted_journey: '',
      impacted_segment: '',
      impacted_customers: '',
      estimated_use_date: '',
      variables: [],
    },
  })

  useEffect(() => {
    if (user?.email) {
      setValue('requester_email', user.email)
    }
  }, [user, setValue])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variables',
  })

  const onReview = (data: CaseFormValues) => {
    // Normalize all text fields to prevent duplication
    const normalizedData = {
      ...data,
      title: normalizeText(data.title),
      client_name: normalizeText(data.client_name),
      macro_case: normalizeText(data.macro_case),
      context: normalizeText(data.context),
      impact: normalizeText(data.impact),
      necessity: normalizeText(data.necessity),
      impacted_journey: normalizeText(data.impacted_journey),
      impacted_segment: normalizeText(data.impacted_segment),
      impacted_customers: normalizeText(data.impacted_customers),
    }
    setFormDataToSubmit(normalizedData)
    setShowConfirmation(true)
  }

  const onConfirmSubmit = async () => {
    if (!formDataToSubmit || isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      // Clean up data before sending - remove empty strings for optional fields
      const cleanedData = {
        ...formDataToSubmit,
        // Convert empty string to undefined for optional date field
        estimated_use_date: formDataToSubmit.estimated_use_date || undefined,
      }
      
      const result = await caseService.create(cleanedData)
      
      toast.success('Case criado com sucesso!')
      
      if (result?.id) {
        navigate(`/cases/${result.id}`)
      } else {
        navigate('/cases')
      }
    } catch (error: any) {
      console.error('Case creation failed:', error)
      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.message ||
                          error.message ||
                          'Falha ao criar case. Por favor, tente novamente.'
      toast.error(`Erro ao criar case: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
      setShowConfirmation(false)
    }
  }

  const handleAddVariable = (variableData: any) => {
   append(variableData)
    setIsVariableModalOpen(false)
  }

  const handleImportVariables = (variables: any[]) => {
    variables.forEach(v => append(v))
    toast.success(`${variables.length} variáveis importadas com sucesso!`)
  }

  const onError = () => {
    toast.error('Por favor, corrija os erros no formulário antes de continuar.')
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/cases" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-orange-700">Painel de adição de case</h1>
            <p className="text-sm text-gray-500">Detalhes do novo case</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-8">
        <form onSubmit={handleSubmit(onReview, onError)} className="space-y-8">
          
          <CaseFormHeader 
            control={control} 
            register={register} 
            errors={errors} 
            existingMacroCases={existingMacroCases} 
            existingClients={existingClients} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <CaseFormDetails register={register} errors={errors} />

            <CaseVariablesList 
              fields={fields} 
              remove={remove} 
              errors={errors} 
              onOpenModal={() => setIsVariableModalOpen(true)}
              onOpenExcelImport={() => setIsExcelImportOpen(true)}
            />
          </div>

          <div className="hidden lg:flex justify-end pt-6 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-orange-600 text-white hover:bg-orange-700 h-10 px-4 py-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Revisar e Enviar
                </>
              )}
            </button>
          </div>

          <StickyFooter 
            onAddVariable={() => setIsVariableModalOpen(true)}
            onSubmit={() => {}}
            isSubmitting={isSubmitting}
          />
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && formDataToSubmit && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
          onClick={(e) => {
            // Only close if clicking the backdrop, not the modal itself
            if (e.target === e.currentTarget) {
              setShowConfirmation(false)
            }
          }}
        >
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 relative shadow-xl">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
              Confirmar Dados do Case
            </h2>
            <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Título:</strong> {formDataToSubmit.title}</div>
                <div><strong>Cliente:</strong> {formDataToSubmit.client_name}</div>
                <div><strong>Macro Case:</strong> {formDataToSubmit.macro_case}</div>
                <div><strong>Solicitante:</strong> {formDataToSubmit.requester_email}</div>
                <div className="col-span-2"><strong>Contexto:</strong> {formDataToSubmit.context}</div>
                <div className="col-span-2"><strong>Impacto:</strong> {formDataToSubmit.impact}</div>
                <div className="col-span-2"><strong>Necessidade:</strong> {formDataToSubmit.necessity}</div>
                <div><strong>Jornada:</strong> {formDataToSubmit.impacted_journey}</div>
                <div><strong>Segmento:</strong> {formDataToSubmit.impacted_segment}</div>
                <div className="col-span-2"><strong>Clientes Impactados:</strong> {formDataToSubmit.impacted_customers}</div>
              </div>
              <div className="border-t pt-2 mt-2">
                <h3 className="font-bold mb-2">Variáveis ({formDataToSubmit.variables.length})</h3>
                <ul className="list-disc pl-5">
                  {formDataToSubmit.variables.map((v, i) => (
                    <li key={i}>{v.variable_name} ({v.product})</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowConfirmation(false)
                }}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Voltar e Editar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isSubmitting) {
                    onConfirmSubmit()
                  }
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Salvando...' : 'Confirmar e Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable Wizard */}
      {isVariableModalOpen && (
        <VariableWizard 
          onClose={() => setIsVariableModalOpen(false)} 
          onAdd={handleAddVariable} 
        />
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImport={handleImportVariables}
      />
    </div>
  )
}
