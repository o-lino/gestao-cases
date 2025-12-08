import { UseFormRegister, FieldErrors } from 'react-hook-form'

interface CaseFormDetailsProps {
  register: UseFormRegister<any>
  errors: FieldErrors<any>
}

export function CaseFormDetails({ register, errors }: CaseFormDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700 block">Contexto do Case:</label>
        <textarea
          {...register('context')}
          className="w-full border rounded p-2 text-sm min-h-[80px]"
          placeholder="Descreva o contexto detalhadamente..."
        />
        {errors.context && <p className="text-xs text-red-500">{errors.context.message as string}</p>}
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700 w-32">Impacto:</label>
        <input
          {...register('impact')}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
      {errors.impact && <p className="text-xs text-red-500 ml-36">{errors.impact.message as string}</p>}

      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700 w-32">Necessidade do case:</label>
        <input
          {...register('necessity')}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
      {errors.necessity && <p className="text-xs text-red-500 ml-36">{errors.necessity.message as string}</p>}

      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700 w-32">Jornada impactada:</label>
        <input
          {...register('impacted_journey')}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
      {errors.impacted_journey && <p className="text-xs text-red-500 ml-36">{errors.impacted_journey.message as string}</p>}

      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700 w-32">Segmento impactado:</label>
        <input
          {...register('impacted_segment')}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
      {errors.impacted_segment && <p className="text-xs text-red-500 ml-36">{errors.impacted_segment.message as string}</p>}

      <div className="flex items-center gap-4">
        <label className="text-sm font-bold text-gray-700 w-32">Clientes impactados:</label>
        <input
          {...register('impacted_customers')}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
      {errors.impacted_customers && <p className="text-xs text-red-500 ml-36">{errors.impacted_customers.message as string}</p>}
    </div>
  )
}
