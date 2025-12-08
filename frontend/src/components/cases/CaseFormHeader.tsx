import {
  Control,
  Controller,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { DatePicker } from "@/components/common/DatePicker";

interface CaseFormHeaderProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  existingMacroCases: { value: string; label: string }[];
  existingClients: { value: string; label: string }[];
}

export function CaseFormHeader({
  control,
  register,
  errors,
  existingMacroCases,
  existingClients,
}: CaseFormHeaderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700 w-32">
            Indique o seu case (Macro):
          </label>
          <div className="flex-1">
            <Controller
              control={control}
              name="macro_case"
              render={({ field }) => (
                <Autocomplete
                  options={existingMacroCases}
                  value={field.value}
                  onChange={field.onChange}
                  onCreate={(val) => field.onChange(val)}
                  placeholder="Selecione ou crie um Macro Case..."
                />
              )}
            />
          </div>
        </div>
        {errors.macro_case && (
          <p className="text-xs text-red-500 ml-36">
            {errors.macro_case.message as string}
          </p>
        )}

        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700 w-32">
            Nome do Subcase:
          </label>
          <input
            {...register("title")}
            className="flex-1 border-b border-gray-300 focus:border-orange-500 outline-none py-1 bg-transparent"
            placeholder="Nome do case"
          />
        </div>
        {errors.title && (
          <p className="text-xs text-red-500 ml-36">
            {errors.title.message as string}
          </p>
        )}

        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700 w-32">
            Cliente:
          </label>
          <div className="flex-1">
            <Controller
              control={control}
              name="client_name"
              render={({ field }) => (
                <Autocomplete
                  options={existingClients}
                  value={field.value}
                  onChange={field.onChange}
                  onCreate={(val) => field.onChange(val)}
                  placeholder="Selecione ou crie um cliente..."
                />
              )}
            />
          </div>
        </div>
        {errors.client_name && (
          <p className="text-xs text-red-500 ml-36">
            {errors.client_name.message as string}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700 w-32">
            Email do solicitante:
          </label>
          <input
            {...register("requester_email")}
            readOnly
            className="flex-1 border-none bg-gray-100 text-gray-500 px-2 py-1 rounded cursor-not-allowed"
            placeholder="Carregando..."
          />
        </div>
        {errors.requester_email && (
          <p className="text-xs text-red-500 ml-36">
            {errors.requester_email.message as string}
          </p>
        )}

        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700 w-32">
            Data Estimada de Uso:
          </label>
          <div className="flex-1">
            <Controller
              control={control}
              name="estimated_use_date"
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.estimated_use_date}
                />
              )}
            />
          </div>
        </div>
        {errors.estimated_use_date && (
          <p className="text-xs text-red-500 ml-36">
            {errors.estimated_use_date.message as string}
          </p>
        )}
      </div>
    </div>
  );
}
