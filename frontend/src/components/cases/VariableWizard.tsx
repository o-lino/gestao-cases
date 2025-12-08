import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { ChevronLeft, ChevronRight, Check, HelpCircle } from 'lucide-react'

const variableSchema = z.object({
  variable_name: z.string().min(3, 'Nome da variável deve ter no mínimo 3 caracteres'),
  concept: z.string().min(10, 'Conceito deve ter no mínimo 10 caracteres'),
  priority: z.string().min(1, 'Prioridade é obrigatória'),
  product: z.string().min(1, 'Produto é obrigatório'),
  desired_lag: z.enum(['D-1', 'M-1'], { errorMap: () => ({ message: 'Selecione D-1 ou M-1' }) }),
  variable_type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  min_history: z.enum(['1 mês', '3 meses', '6 meses', '1 ano']),
})

type VariableFormData = z.infer<typeof variableSchema>

const STEPS = [
  {
    id: 1,
    title: 'Informações Básicas',
    description: 'Nome, conceito e prioridade da variável',
    fields: ['variable_name', 'concept', 'priority'] as const
  },
  {
    id: 2,
    title: 'Classificação',
    description: 'Produto, defasagem e tipo de dado',
    fields: ['product', 'desired_lag', 'variable_type'] as const
  },
  {
    id: 3,
    title: 'Histórico',
    description: 'Período de dados históricos necessário',
    fields: ['min_history'] as const
  }
]

interface VariableWizardProps {
  onAdd: (data: VariableFormData) => void
  onClose: () => void
}

export function VariableWizard({ onAdd, onClose }: VariableWizardProps) {
  const [step, setStep] = useState(0)

  const { 
    register, 
    control,
    handleSubmit,
    formState: { errors }, 
    trigger, 
    getValues 
  } = useForm<VariableFormData>({
    resolver: zodResolver(variableSchema),
    mode: 'onChange'
  })

  const nextStep = async () => {
    const fields = STEPS[step].fields
    const valid = await trigger(fields)
    
    if (valid) {
      setStep(s => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const prevStep = () => {
    setStep(s => Math.max(s - 1, 0))
  }

  const onSubmit = (data: VariableFormData) => {
    onAdd(data)
    onClose()
  }

  const currentStep = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 pt-6 pb-4 z-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Adicionar Variável
          </h2>
          
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between mb-2 text-sm">
              {STEPS.map((s, i) => (
                <div 
                  key={s.id}
                  className={`flex-1 text-center ${
                    i <= step ? 'text-orange-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  <div className="hidden sm:block">{s.title}</div>
                  <div className="sm:hidden">Etapa {i + 1}</div>
                </div>
              ))}
            </div>
            
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-600 transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600">{currentStep.description}</p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 min-h-[300px]">
            {step === 0 && <Step1 register={register} errors={errors} />}
            {step === 1 && <Step2 register={register} control={control} errors={errors} />}
            {step === 2 && <Step3 register={register} errors={errors} getValues={getValues} />}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between">
            <button
              type="button"
              onClick={step === 0 ? onClose : prevStep}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              {step === 0 ? (
                'Cancelar'
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </>
              )}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 transition-colors"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                Adicionar Variável
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// Step 1: Basic Information
function Step1({ register, errors }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome da Variável *
        </label>
        <input
          {...register('variable_name')}
          type="text"
          placeholder="Ex: Taxa de Abertura"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.variable_name && (
          <p className="text-red-600 text-sm mt-1">{errors.variable_name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Conceito *
        </label>
        <textarea
          {...register('concept')}
          rows={4}
          placeholder="Descreva o conceito desta variável..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.concept && (
          <p className="text-red-600 text-sm mt-1">{errors.concept.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prioridade *
        </label>
        <select
          {...register('priority')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Selecione...</option>
          <option value="Alta">Alta</option>
          <option value="Média">Média</option>
          <option value="Baixa">Baixa</option>
        </select>
        {errors.priority && (
          <p className="text-red-600 text-sm mt-1">{errors.priority.message}</p>
        )}
      </div>
    </div>
  )
}

// Step 2: Classification
function Step2({ register, control, errors }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Produto *
        </label>
        <input
          {...register('product')}
          type="text"
          placeholder="Ex: Cartão de Crédito"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.product && (
          <p className="text-red-600 text-sm mt-1">{errors.product.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Defasagem *
          </label>
          <Tooltip text="Indica quando os dados estarão disponíveis. D-1: um dia após o evento. M-1: um mês após o evento." />
        </div>
        <select
          {...register('desired_lag')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Selecione...</option>
          <option value="D-1">D-1 (Um dia)</option>
          <option value="M-1">M-1 (Um mês)</option>
        </select>
        {errors.desired_lag && (
          <p className="text-red-600 text-sm mt-1">{errors.desired_lag.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Dado *
        </label>
        <select
          {...register('variable_type')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Selecione...</option>
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="date">Data</option>
          <option value="boolean">Booleano (Sim/Não)</option>
          <option value="select">Seleção</option>
        </select>
        {errors.variable_type && (
          <p className="text-red-600 text-sm mt-1">{errors.variable_type.message}</p>
        )}
      </div>
    </div>
  )
}

// Step 3: History
function Step3({ register, errors, getValues }: any) {
  const values = getValues()
  
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Histórico Mínimo *
          </label>
          <Tooltip text="Período de dados históricos necessário para análise desta variável." />
        </div>
        <select
          {...register('min_history')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Selecione...</option>
          <option value="1 mês">1 mês</option>
          <option value="3 meses">3 meses</option>
          <option value="6 meses">6 meses</option>
          <option value="1 ano">1 ano</option>
        </select>
        {errors.min_history && (
          <p className="text-red-600 text-sm mt-1">{errors.min_history.message}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Resumo da Variável</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Nome:</strong> {values?.variable_name || '-'}</p>
          <p><strong>Prioridade:</strong> {values?.priority || '-'}</p>
          <p><strong>Produto:</strong> {values?.product || '-'}</p>
          <p><strong>Tipo:</strong> {values?.variable_type || '-'}</p>
        </div>
      </div>
    </div>
  )
}

// Tooltip helper component
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Ajuda"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      
      {show && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
