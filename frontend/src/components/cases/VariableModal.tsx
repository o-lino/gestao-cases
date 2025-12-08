import { useForm, Controller } from 'react-hook-form'
import { X } from 'lucide-react'
import { Autocomplete } from '@/components/ui/Autocomplete'

interface VariableModalProps {
  onClose: () => void
  onAdd: (data: any) => void
}

export function VariableModal({ onClose, onAdd }: VariableModalProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      variable_name: '',
      product: '',
      concept: '',
      min_history: '',
      priority: '',
      desired_lag: '',
      variable_type: 'text',
      options: ''
    }
  })

  const onSubmit = (data: any) => {
    onAdd(data)
  }

  // Mock options for variable dropdowns
  const products = [{ value: 'Cartão de Crédito', label: 'Cartão de Crédito' }, { value: 'Empréstimo', label: 'Empréstimo' }]
  const priorities = [{ value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
          <X className="h-6 w-6" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Adição de variável</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-orange-500 pl-2">Nome da variável:</label>
                <input
                  {...register('variable_name', { required: 'Nome é obrigatório' })}
                  className="w-full border rounded p-2 text-sm"
                  placeholder="Exemplo: Valor de fechamento de fatura"
                />
                {errors.variable_name && <p className="text-xs text-red-500">{errors.variable_name.message as string}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-gray-400 pl-2">Conceito da variável:</label>
                <textarea
                  {...register('concept', { required: 'Conceito é obrigatório' })}
                  className="w-full border rounded p-2 text-sm min-h-[100px]"
                  placeholder="Descreva qual o conceito de sua nova variável"
                />
                {errors.concept && <p className="text-xs text-red-500">{errors.concept.message as string}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-gray-400 pl-2">Prioridade:</label>
                <Controller
                  control={control}
                  name="priority"
                  rules={{ required: 'Prioridade é obrigatória' }}
                  render={({ field }) => (
                    <Autocomplete
                      options={priorities}
                      value={field.value}
                      onChange={field.onChange}
                      onCreate={(val) => field.onChange(val)}
                      placeholder="Selecione ou crie..."
                    />
                  )}
                />
                {errors.priority && <p className="text-xs text-red-500">{errors.priority.message as string}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-gray-400 pl-2">Defasagem desejada:</label>
                <select {...register('desired_lag', { required: 'Defasagem é obrigatória' })} className="w-full border rounded p-2 text-sm">
                  <option value="">Selecione...</option>
                  <option value="D-1">D-1</option>
                  <option value="M-1">M-1</option>
                </select>
                {errors.desired_lag && <p className="text-xs text-red-500">{errors.desired_lag.message as string}</p>}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-orange-500 pl-2">Produto:</label>
                <Controller
                  control={control}
                  name="product"
                  rules={{ required: 'Produto é obrigatório' }}
                  render={({ field }) => (
                    <Autocomplete
                      options={products}
                      value={field.value}
                      onChange={field.onChange}
                      onCreate={(val) => field.onChange(val)}
                      placeholder="Selecione ou crie..."
                    />
                  )}
                />
                {errors.product && <p className="text-xs text-red-500">{errors.product.message as string}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-orange-500 pl-2">Histórico mínimo:</label>
                <select {...register('min_history', { required: 'Histórico é obrigatório' })} className="w-full border rounded p-2 text-sm">
                  <option value="">Selecione...</option>
                  <option value="6 meses">6 meses</option>
                  <option value="12 meses">12 meses</option>
                  <option value="24 meses">24 meses</option>
                </select>
                {errors.min_history && <p className="text-xs text-red-500">{errors.min_history.message as string}</p>}
              </div>

               <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block border-l-4 border-gray-400 pl-2">Tipo de Dado:</label>
                <select {...register('variable_type')} className="w-full border rounded p-2 text-sm">
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="boolean">Booleano</option>
                  <option value="select">Seleção</option>
                </select>
              </div>

              <div className="bg-gray-50 p-4 rounded border mt-8">
                <button 
                  type="submit"
                  className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded font-medium hover:bg-gray-50"
                >
                  Adicionar e concluir
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
