import { useState, useEffect } from 'react'
import { Copy, Layout, Plus, Search, Star, Trash2, Edit2 } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

export interface CaseTemplate {
  id: string
  name: string
  description: string
  category: string
  fields: {
    title?: string
    client_name?: string
    macro_case?: string
    context?: string
    impact?: string
    necessity?: string
  }
  variables: Array<{ name: string; value: string; type: string }>
  createdAt: Date
  usageCount: number
  isFavorite: boolean
}

const DEFAULT_TEMPLATES: CaseTemplate[] = [
  {
    id: 'template-1',
    name: 'Novo Projeto',
    description: 'Template para novos projetos de desenvolvimento',
    category: 'Projetos',
    fields: {
      macro_case: 'DESENVOLVIMENTO',
      context: 'Projeto de desenvolvimento de nova funcionalidade.',
      impact: 'Melhoria na eficiência operacional.',
    },
    variables: [
      { name: 'Prazo Estimado', value: '', type: 'text' },
      { name: 'Equipe Responsável', value: '', type: 'text' },
    ],
    createdAt: new Date(),
    usageCount: 0,
    isFavorite: true,
  },
  {
    id: 'template-2',
    name: 'Manutenção',
    description: 'Template para casos de manutenção e correção',
    category: 'Manutenção',
    fields: {
      macro_case: 'MANUTENCAO',
      context: 'Manutenção corretiva ou preventiva.',
    },
    variables: [
      { name: 'Urgência', value: 'Alta', type: 'select' },
    ],
    createdAt: new Date(),
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'template-3',
    name: 'Solicitação de Cliente',
    description: 'Template para demandas originadas de clientes',
    category: 'Clientes',
    fields: {
      macro_case: 'CLIENTE',
      impact: 'Atendimento às necessidades do cliente.',
    },
    variables: [
      { name: 'Nome do Contato', value: '', type: 'text' },
      { name: 'Canal de Entrada', value: 'Email', type: 'select' },
    ],
    createdAt: new Date(),
    usageCount: 0,
    isFavorite: false,
  },
]

interface TemplateManagerProps {
  onSelectTemplate: (template: CaseTemplate) => void
  isOpen: boolean
  onClose: () => void
}

export function TemplateManager({ onSelectTemplate, isOpen, onClose }: TemplateManagerProps) {
  const toast = useToast()
  const [templates, setTemplates] = useState<CaseTemplate[]>(() => {
    const saved = localStorage.getItem('caseTemplates')
    if (saved) {
      const parsed = JSON.parse(saved)
      return [...DEFAULT_TEMPLATES, ...parsed]
    }
    return DEFAULT_TEMPLATES
  })
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const customTemplates = templates.filter(t => !t.id.startsWith('template-'))
    localStorage.setItem('caseTemplates', JSON.stringify(customTemplates))
  }, [templates])

  const categories = ['all', ...new Set(templates.map(t => t.category))]
  
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleUseTemplate = (template: CaseTemplate) => {
    // Increment usage count
    setTemplates(prev => prev.map(t => 
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    ))
    onSelectTemplate(template)
    onClose()
    toast.success(`Template "${template.name}" aplicado`)
  }

  const handleToggleFavorite = (id: string) => {
    setTemplates(prev => prev.map(t =>
      t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
    ))
  }

  const handleDeleteTemplate = (id: string) => {
    if (id.startsWith('template-')) {
      toast.error('Templates padrão não podem ser excluídos')
      return
    }
    if (confirm('Excluir este template?')) {
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template excluído')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Escolher Template
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um template para iniciar rapidamente
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'Todas as categorias' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Templates Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Create New Template Card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors min-h-[160px]"
            >
              <Plus className="h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Criar Template</span>
              <span className="text-xs text-muted-foreground">A partir do case atual</span>
            </button>

            {/* Template Cards */}
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium">{template.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                      {template.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(template.id)}
                    className="text-muted-foreground hover:text-yellow-500"
                  >
                    <Star className={`h-4 w-4 ${template.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  </button>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {template.description}
                </p>
                
                <div className="text-xs text-muted-foreground mb-3">
                  {template.variables.length} variáveis • Usado {template.usageCount}x
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                  >
                    Usar Template
                  </button>
                  {!template.id.startsWith('template-') && (
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum template encontrado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook to use templates in CaseForm
export function useTemplates() {
  const [templates, setTemplates] = useState<CaseTemplate[]>([])
  
  useEffect(() => {
    const saved = localStorage.getItem('caseTemplates')
    const custom = saved ? JSON.parse(saved) : []
    setTemplates([...DEFAULT_TEMPLATES, ...custom])
  }, [])
  
  const saveAsTemplate = (caseData: any, name: string, description: string, category: string) => {
    const newTemplate: CaseTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description,
      category,
      fields: {
        title: caseData.title,
        client_name: caseData.client_name,
        macro_case: caseData.macro_case,
        context: caseData.context,
        impact: caseData.impact,
        necessity: caseData.necessity,
      },
      variables: caseData.variables || [],
      createdAt: new Date(),
      usageCount: 0,
      isFavorite: false,
    }
    
    const saved = localStorage.getItem('caseTemplates')
    const existing = saved ? JSON.parse(saved) : []
    localStorage.setItem('caseTemplates', JSON.stringify([...existing, newTemplate]))
    
    return newTemplate
  }
  
  return { templates, saveAsTemplate }
}
