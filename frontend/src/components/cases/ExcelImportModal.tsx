/**
 * Excel Import Modal
 * 
 * Smart Excel/CSV import for case variables with:
 * - Flexible column detection
 * - Auto-mapping based on column names
 * - Manual mapping override
 * - Preview and validation
 */

import { useState, useCallback } from 'react'
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  Download,
  Trash2,
  Edit2,
  RefreshCw
} from 'lucide-react'

interface VariableData {
  variable_name: string
  variable_type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  product: string
  concept: string
  min_history: string
  priority: string
  desired_lag: string
  options?: string
}

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (variables: VariableData[]) => void
}

// Column name mappings for smart detection
const COLUMN_MAPPINGS: Record<keyof VariableData, string[]> = {
  variable_name: ['nome', 'variavel', 'variable', 'name', 'campo', 'var', 'nome_variavel', 'nome da variável', 'variável'],
  product: ['produto', 'product', 'prod', 'produtos'],
  concept: ['conceito', 'concept', 'desc', 'descrição', 'description', 'descricao', 'definição', 'definicao'],
  min_history: ['historico', 'history', 'hist', 'mínimo', 'minimo', 'historico_minimo', 'histórico mínimo', 'min_history'],
  priority: ['prioridade', 'priority', 'prio', 'importancia', 'importância'],
  desired_lag: ['defasagem', 'lag', 'atraso', 'delay', 'desired_lag'],
  variable_type: ['tipo', 'type', 'tipo_variavel'],
  options: ['opcoes', 'options', 'valores', 'opções', 'choices'],
}

// Default values for unmapped fields
const DEFAULT_VALUES: Partial<VariableData> = {
  variable_type: 'text',
  priority: 'Média',
  desired_lag: '0',
  min_history: '12 meses',
}

// Required fields for validation
const REQUIRED_FIELDS: (keyof VariableData)[] = ['variable_name', 'product', 'concept']

// Field display names
const FIELD_LABELS: Record<keyof VariableData, string> = {
  variable_name: 'Nome da Variável',
  product: 'Produto',
  concept: 'Conceito',
  min_history: 'Histórico Mínimo',
  priority: 'Prioridade',
  desired_lag: 'Defasagem',
  variable_type: 'Tipo',
  options: 'Opções',
}

type ImportStep = 'upload' | 'mapping' | 'preview'

export function ExcelImportModal({ isOpen, onClose, onImport }: ExcelImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rawData, setRawData] = useState<string[][]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, keyof VariableData | ''>>({})
  const [parsedVariables, setParsedVariables] = useState<VariableData[]>([])
  const [errors, setErrors] = useState<Record<number, string[]>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Reset state when modal closes
  const handleClose = () => {
    setStep('upload')
    setFileName('')
    setRawData([])
    setDetectedColumns([])
    setColumnMapping({})
    setParsedVariables([])
    setErrors({})
    onClose()
  }

  // Smart column detection
  const detectColumnMapping = (columns: string[]): Record<string, keyof VariableData | ''> => {
    const mapping: Record<string, keyof VariableData | ''> = {}
    
    columns.forEach(col => {
      const normalizedCol = col.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      
      for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
        for (const alias of aliases) {
          const normalizedAlias = alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          if (normalizedCol.includes(normalizedAlias) || normalizedAlias.includes(normalizedCol)) {
            mapping[col] = field as keyof VariableData
            break
          }
        }
        if (mapping[col]) break
      }
      
      if (!mapping[col]) {
        mapping[col] = ''
      }
    })
    
    return mapping
  }

  // Parse file (CSV or Excel)
  const parseFile = async (file: File) => {
    setIsLoading(true)
    
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      
      if (extension === 'csv') {
        // Parse CSV
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        const data = lines.map(line => {
          // Handle quoted values with commas and semicolons
          const result: string[] = []
          let current = ''
          let inQuotes = false
          const separator = line.includes(';') ? ';' : ','
          
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === separator && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result
        })
        
        if (data.length > 0) {
          setDetectedColumns(data[0])
          setRawData(data.slice(1))
          setColumnMapping(detectColumnMapping(data[0]))
          setFileName(file.name)
          setStep('mapping')
        }
      } else {
        // Parse Excel using xlsx library
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 })
        
        if (jsonData.length > 0) {
          const headers = (jsonData[0] as string[]).map((h: any) => String(h || '').trim())
          const rows = jsonData.slice(1).filter((row: any) => 
            Array.isArray(row) && row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim())
          )
          
          setDetectedColumns(headers)
          setRawData(rows.map((row: any) => (row as any[]).map((cell: any) => String(cell ?? ''))))
          setColumnMapping(detectColumnMapping(headers))
          setFileName(file.name)
          setStep('mapping')
        }
      }
    } catch (error) {
      console.error('Error parsing file:', error)
      alert('Erro ao ler o arquivo. Verifique se é um arquivo Excel ou CSV válido.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
        parseFile(file)
      } else {
        alert('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)')
      }
    }
  }, [])

  // Handle file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseFile(file)
    }
  }

  // Process mapping and generate preview
  const processMapping = () => {
    const variables: VariableData[] = []
    const newErrors: Record<number, string[]> = {}
    
    rawData.forEach((row, rowIndex) => {
      const variable: Partial<VariableData> = { ...DEFAULT_VALUES }
      const rowErrors: string[] = []
      
      detectedColumns.forEach((col, colIndex) => {
        const mappedField = columnMapping[col]
        if (mappedField && row[colIndex]) {
          (variable as any)[mappedField] = row[colIndex].trim()
        }
      })
      
      // Validate required fields
      REQUIRED_FIELDS.forEach(field => {
        if (!variable[field]) {
          rowErrors.push(`${FIELD_LABELS[field]} é obrigatório`)
        }
      })
      
      // Validate variable_name length
      if (variable.variable_name && variable.variable_name.length < 3) {
        rowErrors.push('Nome da variável deve ter no mínimo 3 caracteres')
      }
      
      // Validate concept length
      if (variable.concept && variable.concept.length < 10) {
        rowErrors.push('Conceito deve ter no mínimo 10 caracteres')
      }
      
      if (rowErrors.length > 0) {
        newErrors[rowIndex] = rowErrors
      }
      
      variables.push(variable as VariableData)
    })
    
    setParsedVariables(variables)
    setErrors(newErrors)
    setStep('preview')
  }

  // Update variable in preview
  const updateVariable = (index: number, field: keyof VariableData, value: string) => {
    setParsedVariables(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    
    // Re-validate
    const variable = parsedVariables[index]
    const rowErrors: string[] = []
    
    const updatedVar = { ...variable, [field]: value }
    
    REQUIRED_FIELDS.forEach(f => {
      if (!updatedVar[f]) {
        rowErrors.push(`${FIELD_LABELS[f]} é obrigatório`)
      }
    })
    
    if (updatedVar.variable_name && updatedVar.variable_name.length < 3) {
      rowErrors.push('Nome da variável deve ter no mínimo 3 caracteres')
    }
    
    if (updatedVar.concept && updatedVar.concept.length < 10) {
      rowErrors.push('Conceito deve ter no mínimo 10 caracteres')
    }
    
    setErrors(prev => {
      const updated = { ...prev }
      if (rowErrors.length > 0) {
        updated[index] = rowErrors
      } else {
        delete updated[index]
      }
      return updated
    })
  }

  // Remove variable from preview
  const removeVariable = (index: number) => {
    setParsedVariables(prev => prev.filter((_, i) => i !== index))
    setErrors(prev => {
      const updated: Record<number, string[]> = {}
      Object.entries(prev).forEach(([key, value]) => {
        const keyNum = parseInt(key)
        if (keyNum < index) {
          updated[keyNum] = value
        } else if (keyNum > index) {
          updated[keyNum - 1] = value
        }
      })
      return updated
    })
  }

  // Final import
  const handleImport = () => {
    if (Object.keys(errors).length > 0) {
      alert('Corrija os erros antes de importar')
      return
    }
    
    if (parsedVariables.length === 0) {
      alert('Nenhuma variável para importar')
      return
    }
    
    onImport(parsedVariables)
    handleClose()
  }

  // Download template (Excel format)
  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx')
      
      const templateData = [
        ['Nome da Variável', 'Produto', 'Conceito', 'Histórico Mínimo', 'Prioridade', 'Defasagem', 'Tipo', 'Opções'],
        ['Exemplo Variável 1', 'Cartão de Crédito', 'Descrição detalhada do conceito da variável (mínimo 10 caracteres)', '12 meses', 'Alta', '30 dias', 'text', ''],
        ['Exemplo Variável 2', 'Empréstimo', 'Outro conceito detalhado para segunda variável de exemplo', '6 meses', 'Média', '0', 'number', ''],
      ]
      
      const ws = XLSX.utils.aoa_to_sheet(templateData)
      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 50 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }
      ]
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Variáveis')
      XLSX.writeFile(wb, 'template_variaveis.xlsx')
    } catch (error) {
      console.error('Error generating template:', error)
      // Fallback to CSV
      const headers = ['Nome da Variável', 'Produto', 'Conceito', 'Histórico Mínimo', 'Prioridade', 'Defasagem', 'Tipo', 'Opções']
      const row1 = ['Exemplo Variável 1', 'Cartão de Crédito', 'Descrição detalhada do conceito', '12 meses', 'Alta', '30 dias', 'text', '']
      const row2 = ['Exemplo Variável 2', 'Empréstimo', 'Outro conceito detalhado', '6 meses', 'Média', '0', 'number', '']
      
      const csvContent = [headers, row1, row2]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'template_variaveis.csv'
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-semibold">Importar Variáveis</h2>
              <p className="text-sm text-white/80">
                {step === 'upload' && 'Faça upload de um arquivo Excel ou CSV'}
                {step === 'mapping' && 'Verifique o mapeamento das colunas'}
                {step === 'preview' && 'Revise os dados antes de importar'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 border-b">
          {(['upload', 'mapping', 'preview'] as ImportStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-green-600 text-white' :
                (['upload', 'mapping', 'preview'].indexOf(step) > i) ? 'bg-green-100 text-green-600' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium text-green-700' : 'text-gray-500'}`}>
                {s === 'upload' && 'Upload'}
                {s === 'mapping' && 'Mapeamento'}
                {s === 'preview' && 'Preview'}
              </span>
              {i < 2 && <ChevronRight className="h-4 w-4 text-gray-400 ml-2" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
                    <p className="text-gray-600">Processando arquivo...</p>
                  </div>
                ) : (
                  <>
                    <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Arraste um arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Formatos aceitos: .xlsx, .xls, .csv
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">
                      <FileSpreadsheet className="h-4 w-4" />
                      Selecionar Arquivo
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Template download */}
              <div className="flex items-center justify-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700">
                  <strong>Dica:</strong> Não sabe qual formato usar? Baixe nosso template de exemplo.
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar Template
                </button>
              </div>

              {/* Flexibility notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 mb-2">📋 Flexibilidade de Formatos</h4>
                <p className="text-sm text-amber-700 mb-2">
                  Não se preocupe com o nome exato das colunas! O sistema detecta automaticamente correspondências como:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['nome → Nome da Variável', 'prod → Produto', 'desc → Conceito', 'hist → Histórico'].map(example => (
                    <span key={example} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Arquivo: {fileName}</h3>
                  <p className="text-sm text-gray-500">{rawData.length} linhas encontradas</p>
                </div>
                <button
                  onClick={() => {
                    setColumnMapping(detectColumnMapping(detectedColumns))
                  }}
                  className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Redetectar
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 whitespace-nowrap">Coluna no Arquivo</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 whitespace-nowrap">→</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 whitespace-nowrap">Campo no Sistema</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 whitespace-nowrap">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detectedColumns.map((col, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{col}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">→</td>
                          <td className="px-4 py-3 min-w-[150px]">
                            <select
                              value={columnMapping[col] || ''}
                              onChange={(e) => setColumnMapping(prev => ({
                                ...prev,
                                [col]: e.target.value as keyof VariableData | ''
                              }))}
                              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                                columnMapping[col] ? 'border-green-300 bg-green-50' : 'border-gray-300'
                              }`}
                            >
                              <option value="">-- Ignorar --</option>
                              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                            {rawData[0]?.[i] || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Required fields check */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">Campos obrigatórios:</h4>
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_FIELDS.map(field => {
                    const isMapped = Object.values(columnMapping).includes(field)
                    return (
                      <span key={field} className={`text-xs px-2 py-1 rounded-full ${
                        isMapped ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isMapped ? '✓' : '✗'} {FIELD_LABELS[field]}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {parsedVariables.length} variáveis para importar
                  </h3>
                  {Object.keys(errors).length > 0 && (
                    <p className="text-sm text-red-600">
                      {Object.keys(errors).length} variáveis com erros
                    </p>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Nome</th>
                      <th className="px-3 py-2 text-left font-medium">Produto</th>
                      <th className="px-3 py-2 text-left font-medium">Conceito</th>
                      <th className="px-3 py-2 text-left font-medium">Histórico</th>
                      <th className="px-3 py-2 text-left font-medium">Prioridade</th>
                      <th className="px-3 py-2 text-left font-medium">Defasagem</th>
                      <th className="px-3 py-2 text-left font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedVariables.map((variable, i) => (
                      <tr key={i} className={errors[i] ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.variable_name || ''}
                            onChange={(e) => updateVariable(i, 'variable_name', e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-sm ${
                              errors[i]?.some(e => e.includes('Nome')) ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.product || ''}
                            onChange={(e) => updateVariable(i, 'product', e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-sm ${
                              errors[i]?.some(e => e.includes('Produto')) ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.concept || ''}
                            onChange={(e) => updateVariable(i, 'concept', e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-sm ${
                              errors[i]?.some(e => e.includes('Conceito')) ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.min_history || ''}
                            onChange={(e) => updateVariable(i, 'min_history', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.priority || ''}
                            onChange={(e) => updateVariable(i, 'priority', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variable.desired_lag || ''}
                            onChange={(e) => updateVariable(i, 'desired_lag', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeVariable(i)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Errors summary */}
              {Object.keys(errors).length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Erros encontrados
                  </div>
                  <div className="space-y-1 text-sm text-red-600">
                    {Object.entries(errors).map(([row, rowErrors]) => (
                      <p key={row}>
                        <strong>Linha {parseInt(row) + 1}:</strong> {rowErrors.join(', ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div>
            {step !== 'upload' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            {step === 'mapping' && (
              <button
                onClick={processMapping}
                disabled={!REQUIRED_FIELDS.every(f => Object.values(columnMapping).includes(f))}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={Object.keys(errors).length > 0 || parsedVariables.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-4 w-4" />
                Importar {parsedVariables.length} Variáveis
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
