import { useState } from 'react'
import { Calendar } from 'lucide-react'

interface DatePickerProps {
  value?: string // ISO date string YYYY-MM-DD
  onChange: (date: string) => void
  label?: string
  error?: { message?: string }
  placeholder?: string
}

export function DatePicker({ value, onChange, label, error, placeholder = 'Selecione uma data' }: DatePickerProps) {
  const [showNative, setShowNative] = useState(false)

  // Convert ISO to Brazilian format for display
  const formatToBrazilian = (isoDate: string): string => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }

  const displayValue = value ? formatToBrazilian(value) : ''

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Visual button trigger */}
        <button
          type="button"
          onClick={() => setShowNative(true)}
          className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-left transition-colors ${
            error 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 hover:border-gray-400 focus:ring-orange-500'
          }`}
        >
          <Calendar className="w-5 h-5 text-gray-500" />
          <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
            {displayValue || placeholder}
          </span>
        </button>

        {/* Native date input (hidden but functional) */}
        <input
          type="date"
          value={value || ''}
          onChange={(e) => {
            onChange(e.target.value)
            setShowNative(false)
          }}
          onBlur={() => setShowNative(false)}
          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${
            showNative ? 'z-10' : 'z-0 pointer-events-none'
          }`}
          aria-label={label}
        />
      </div>

      {error?.message && (
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Formato: dd/mm/aaaa
      </p>
    </div>
  )
}
