import { useState, useEffect, useRef } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface AutocompleteProps {
  options: Option[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  onCreate?: (value: string) => void
  className?: string
}

export function Autocomplete({
  options = [],
  value,
  onChange,
  placeholder = "Selecione...",
  onCreate,
  className
}: AutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || "")
  const [filteredOptions, setFilteredOptions] = useState<Option[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter options based on input
  useEffect(() => {
    const normalizedInput = inputValue.toLowerCase().trim()
    const filtered = options.filter(option => 
      option.label.toLowerCase().includes(normalizedInput)
    )
    setFilteredOptions(filtered)
  }, [inputValue, options])

  // Sync internal input with external value
  useEffect(() => {
    if (value !== undefined) {
      const selected = options.find(o => o.value === value)
      setInputValue(selected ? selected.label : value)
    }
  }, [value, options])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (option: Option) => {
    onChange(option.value)
    setInputValue(option.label)
    setOpen(false)
  }

  const handleCreate = () => {
    const trimmed = inputValue.trim()
    if (trimmed) {
      onChange(trimmed)
      if (onCreate) onCreate(trimmed)
      setOpen(false)
    }
  }

  // Auto-commit value on blur - this is the key fix!
  const handleBlur = () => {
    const trimmed = inputValue.trim()
    if (trimmed && trimmed !== value) {
      // Check if it matches an existing option
      const matchingOption = options.find(o => 
        o.label.toLowerCase() === trimmed.toLowerCase()
      )
      if (matchingOption) {
        onChange(matchingOption.value)
      } else {
        // Commit the typed value directly
        onChange(trimmed)
      }
    }
    // Delay closing to allow click events on options to fire
    setTimeout(() => setOpen(false), 150)
  }

  const showCreateOption = onCreate && inputValue.trim() && 
    !filteredOptions.find(o => o.label.toLowerCase() === inputValue.toLowerCase().trim())

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full border rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setOpen(true)
            if (e.target.value === '') onChange('')
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {open && (inputValue || filteredOptions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length === 0 && !showCreateOption && (
            <div className="px-4 py-2 text-sm text-gray-500">Nenhum resultado encontrado.</div>
          )}
          
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between",
                value === option.value && "bg-orange-50 text-orange-900"
              )}
            >
              {option.label}
              {value === option.value && <Check className="h-4 w-4" />}
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-orange-600 font-medium flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar "{inputValue}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
