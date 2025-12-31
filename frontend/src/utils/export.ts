// Export utilities for cases

// Export case to PDF (using browser print)
export function exportCaseToPDF(caseData: any) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const statusLabels: Record<string, string> = {
    DRAFT: 'Rascunho',
    SUBMITTED: 'Enviado',
    REVIEW: 'Em Revisão',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
    CLOSED: 'Fechado',
  }

  const formatDate = (dateStr: string) => 
    dateStr ? new Date(dateStr).toLocaleDateString('pt-BR') : '-'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Case #${caseData.id} - ${caseData.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .status { padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; }
        .status-APPROVED { background: #d4edda; color: #155724; }
        .status-REJECTED { background: #f8d7da; color: #721c24; }
        .status-DRAFT { background: #fff3cd; color: #856404; }
        .status-default { background: #e2e3e5; color: #383d41; }
        .section { margin: 20px 0; }
        .section h2 { font-size: 16px; color: #4a4a4a; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .field { margin: 10px 0; }
        .field label { font-weight: bold; color: #666; display: block; margin-bottom: 4px; }
        .field value { color: #333; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .variables { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .variable { padding: 8px 0; border-bottom: 1px solid #eee; }
        .variable:last-child { border-bottom: none; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Case #${caseData.id}</h1>
        <span class="status status-${caseData.status}">${statusLabels[caseData.status] || caseData.status}</span>
      </div>

      <div class="section">
        <h2>Informações Gerais</h2>
        <div class="grid">
          <div class="field">
            <label>Título</label>
            <value>${caseData.title}</value>
          </div>
          <div class="field">
            <label>Cliente</label>
            <value>${caseData.client_name || '-'}</value>
          </div>
          <div class="field">
            <label>Macro Case</label>
            <value>${caseData.macro_case || '-'}</value>
          </div>
          <div class="field">
            <label>Solicitante</label>
            <value>${caseData.requester_email || '-'}</value>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Datas</h2>
        <div class="grid">
          <div class="field">
            <label>Data Início</label>
            <value>${formatDate(caseData.start_date)}</value>
          </div>
          <div class="field">
            <label>Data Fim</label>
            <value>${formatDate(caseData.end_date)}</value>
          </div>
          <div class="field">
            <label>Criado em</label>
            <value>${formatDate(caseData.created_at)}</value>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Contexto</h2>
        <p>${caseData.context || 'Não informado'}</p>
      </div>

      <div class="section">
        <h2>Impacto</h2>
        <p>${caseData.impact || 'Não informado'}</p>
      </div>

      <div class="section">
        <h2>Necessidade</h2>
        <p>${caseData.necessity || 'Não informado'}</p>
      </div>

      ${caseData.variables && caseData.variables.length > 0 ? `
        <div class="section">
          <h2>Variáveis</h2>
          <div class="variables">
            ${caseData.variables.map((v: any) => `
              <div class="variable">
                <label>${v.name}</label>
                <value>${v.value}</value>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="footer">
        <p>Exportado em ${new Date().toLocaleString('pt-BR')} | Sistema de Gestão de Cases v2.0</p>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

// Export cases list to CSV
export function exportCasesToCSV(cases: any[], filename: string = 'cases') {
  const headers = [
    'ID',
    'Título',
    'Cliente',
    'Macro Case',
    'Status',
    'Data Início',
    'Data Fim',
    'Solicitante',
    'Criado em',
  ]

  const rows = cases.map(c => [
    c.id,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${(c.client_name || '').replace(/"/g, '""')}"`,
    `"${(c.macro_case || '').replace(/"/g, '""')}"`,
    c.status,
    c.start_date || '',
    c.end_date || '',
    c.requester_email || '',
    c.created_at || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
  
  // Create download link
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// Export cases list to JSON
export function exportCasesToJSON(cases: any[], filename: string = 'cases') {
  const jsonContent = JSON.stringify(cases, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json' })
  
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}
