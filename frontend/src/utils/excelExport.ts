import { Case } from '@/services/caseService'

// Native browser download helper (replaces file-saver)
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Excel export using CSV with special encoding for Excel compatibility
export function exportCasesToExcel(cases: Case[], filename: string = 'cases') {
  const BOM = '\uFEFF' // UTF-8 BOM for Excel
  
  const headers = [
    'ID',
    'Título',
    'Cliente',
    'Status',
    'Macro Case',
    'Email Solicitante',
    'Contexto',
    'Impacto',
    'Necessidade',
    'Jornada Impactada',
    'Segmento Impactado',
    'Clientes Impactados',
    'Data Início',
    'Data Fim',
    'Criado Em',
    'Atualizado Em',
    'Qtd Variáveis',
  ]
  
  const rows = cases.map(c => [
    c.id,
    escapeCSV(c.title),
    escapeCSV(c.client_name || ''),
    c.status,
    escapeCSV(c.macro_case || ''),
    escapeCSV(c.requester_email || ''),
    escapeCSV(c.context || ''),
    escapeCSV(c.impact || ''),
    escapeCSV(c.necessity || ''),
    escapeCSV(c.impacted_journey || ''),
    escapeCSV(c.impacted_segment || ''),
    c.impacted_customers || '',
    c.start_date || '',
    c.end_date || '',
    formatDate(c.created_at),
    formatDate(c.updated_at),
    c.variables?.length || 0,
  ])
  
  const csvContent = BOM + [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\r\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  downloadFile(blob, `${filename}_${formatDateForFilename(new Date())}.csv`)
}

// Full Excel export with multiple sheets (requires xlsx library)
export async function exportCasesToXLSX(cases: Case[], filename: string = 'cases') {
  try {
    // Dynamic import to avoid bundling if not used
    const XLSX = await import('xlsx')
    
    // Main cases sheet
    const casesData = cases.map(c => ({
      'ID': c.id,
      'Título': c.title,
      'Cliente': c.client_name || '',
      'Status': c.status,
      'Macro Case': c.macro_case || '',
      'Email Solicitante': c.requester_email || '',
      'Contexto': c.context || '',
      'Impacto': c.impact || '',
      'Necessidade': c.necessity || '',
      'Jornada Impactada': c.impacted_journey || '',
      'Segmento Impactado': c.impacted_segment || '',
      'Clientes Impactados': c.impacted_customers || '',
      'Data Início': c.start_date || '',
      'Data Fim': c.end_date || '',
      'Criado Em': formatDate(c.created_at),
      'Atualizado Em': formatDate(c.updated_at),
    }))
    
    // Variables sheet
    const variablesData: any[] = []
    cases.forEach(c => {
      c.variables?.forEach(v => {
        variablesData.push({
          'Case ID': c.id,
          'Case Título': c.title,
          'Variável Nome': v.name,
          'Variável Valor': v.value,
          'Variável Tipo': v.type || 'text',
        })
      })
    })
    
    // Summary sheet
    const statusCounts: Record<string, number> = {}
    const clientCounts: Record<string, number> = {}
    
    cases.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
      if (c.client_name) {
        clientCounts[c.client_name] = (clientCounts[c.client_name] || 0) + 1
      }
    })
    
    const summaryData = [
      { 'Métrica': 'Total de Cases', 'Valor': cases.length },
      { 'Métrica': 'Total de Variáveis', 'Valor': variablesData.length },
      { 'Métrica': '', 'Valor': '' },
      { 'Métrica': '--- Por Status ---', 'Valor': '' },
      ...Object.entries(statusCounts).map(([status, count]) => ({
        'Métrica': status,
        'Valor': count,
      })),
      { 'Métrica': '', 'Valor': '' },
      { 'Métrica': '--- Por Cliente ---', 'Valor': '' },
      ...Object.entries(clientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([client, count]) => ({
          'Métrica': client,
          'Valor': count,
        })),
    ]
    
    // Create workbook
    const wb = XLSX.utils.book_new()
    
    const wsCases = XLSX.utils.json_to_sheet(casesData)
    XLSX.utils.book_append_sheet(wb, wsCases, 'Cases')
    
    if (variablesData.length > 0) {
      const wsVars = XLSX.utils.json_to_sheet(variablesData)
      XLSX.utils.book_append_sheet(wb, wsVars, 'Variáveis')
    }
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo')
    
    // Set column widths
    wsCases['!cols'] = [
      { wch: 5 },  // ID
      { wch: 40 }, // Título
      { wch: 20 }, // Cliente
      { wch: 12 }, // Status
      { wch: 20 }, // Macro
      { wch: 30 }, // Email
      { wch: 50 }, // Contexto
      { wch: 50 }, // Impacto
      { wch: 50 }, // Necessidade
    ]
    
    // Write file
    XLSX.writeFile(wb, `${filename}_${formatDateForFilename(new Date())}.xlsx`)
    
    return true
  } catch (error) {
    console.error('Excel export failed:', error)
    // Fallback to CSV
    exportCasesToExcel(cases, filename)
    return false
  }
}

// Helper functions
function escapeCSV(value: string): string {
  if (!value) return ''
  // Escape quotes and wrap in quotes if contains separator or newline
  const escaped = value.replace(/"/g, '""')
  if (escaped.includes(';') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`
  }
  return escaped
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleString('pt-BR')
  } catch {
    return dateString
  }
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0]
}



// Import from Excel/CSV
export async function importCasesFromExcel(file: File): Promise<Partial<Case>[]> {
  try {
    const XLSX = await import('xlsx')
    
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any>(firstSheet)
    
    return rows.map(row => ({
      title: row['Título'] || row['titulo'] || row['title'],
      client_name: row['Cliente'] || row['cliente'] || row['client_name'],
      macro_case: row['Macro Case'] || row['macro_case'] || row['macro'],
      requester_email: row['Email Solicitante'] || row['email'] || row['requester_email'],
      context: row['Contexto'] || row['contexto'] || row['context'],
      impact: row['Impacto'] || row['impacto'] || row['impact'],
      necessity: row['Necessidade'] || row['necessidade'] || row['necessity'],
    }))
  } catch (error) {
    console.error('Import failed:', error)
    throw new Error('Falha ao importar arquivo. Verifique o formato.')
  }
}
