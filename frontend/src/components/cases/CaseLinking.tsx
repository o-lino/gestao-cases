import { useState, useEffect } from 'react'
import { Link2, Plus, X, ExternalLink, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Case, caseService } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'

type LinkType = 'parent' | 'child' | 'related' | 'blocks' | 'blocked_by'

interface CaseLink {
  id: string
  sourceId: number
  targetId: number
  type: LinkType
  createdAt: Date
}

const LINK_TYPES: { value: LinkType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'parent', label: 'Case Pai', icon: ArrowUpRight },
  { value: 'child', label: 'Subcase', icon: ArrowDownRight },
  { value: 'related', label: 'Relacionado', icon: Link2 },
  { value: 'blocks', label: 'Bloqueia', icon: Minus },
  { value: 'blocked_by', label: 'Bloqueado por', icon: Minus },
]

interface CaseLinkingProps {
  caseId: number
  readonly?: boolean
}

export function CaseLinking({ caseId, readonly = false }: CaseLinkingProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [links, setLinks] = useState<CaseLink[]>(() => {
    const saved = localStorage.getItem(`caseLinks-${caseId}`)
    return saved ? JSON.parse(saved) : []
  })
  const [linkedCases, setLinkedCases] = useState<Map<number, Case>>(new Map())
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Case[]>([])
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('related')
  const [loading, setLoading] = useState(false)

  // Save links to localStorage
  useEffect(() => {
    localStorage.setItem(`caseLinks-${caseId}`, JSON.stringify(links))
  }, [links, caseId])

  // Fetch linked cases details
  useEffect(() => {
    const fetchLinkedCases = async () => {
      const targetIds = links.map(l => l.targetId)
      if (targetIds.length === 0) return

      try {
        const cases = await caseService.getAll()
        const caseMap = new Map<number, Case>()
        cases.forEach(c => {
          if (targetIds.includes(c.id)) {
            caseMap.set(c.id, c)
          }
        })
        setLinkedCases(caseMap)
      } catch (error) {
        console.error('Failed to fetch linked cases:', error)
      }
    }
    fetchLinkedCases()
  }, [links])

  // Search for cases
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await caseService.getAll()
        const filtered = results.filter(c =>
          c.id !== caseId &&
          !links.find(l => l.targetId === c.id) &&
          (c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.client_name?.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        setSearchResults(filtered.slice(0, 5))
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, caseId, links])

  const handleAddLink = (targetCase: Case) => {
    const newLink: CaseLink = {
      id: `link-${Date.now()}`,
      sourceId: caseId,
      targetId: targetCase.id,
      type: selectedLinkType,
      createdAt: new Date(),
    }
    setLinks(prev => [...prev, newLink])
    setShowAddModal(false)
    setSearchQuery('')
    toast.success(`Case #${targetCase.id} vinculado como ${LINK_TYPES.find(t => t.value === selectedLinkType)?.label}`)
  }

  const handleRemoveLink = (linkId: string) => {
    if (confirm('Remover este vínculo?')) {
      setLinks(prev => prev.filter(l => l.id !== linkId))
      toast.success('Vínculo removido')
    }
  }

  // Group links by type
  const groupedLinks = LINK_TYPES.map(type => ({
    ...type,
    links: links.filter(l => l.type === type.value),
  })).filter(g => g.links.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Cases Vinculados
        </h3>
        {!readonly && (
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Vincular Case
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          Nenhum case vinculado
        </p>
      ) : (
        <div className="space-y-4">
          {groupedLinks.map(group => (
            <div key={group.value} className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <group.icon className="h-3 w-3" />
                {group.label}s ({group.links.length})
              </h4>
              <div className="space-y-1">
                {group.links.map(link => {
                  const linkedCase = linkedCases.get(link.targetId)
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                    >
                      <button
                        onClick={() => navigate(`/cases/${link.targetId}`)}
                        className="flex items-center gap-2 text-left hover:text-primary"
                      >
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">#{link.targetId}</span>
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {linkedCase?.title || 'Carregando...'}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </button>
                      {!readonly && (
                        <button
                          onClick={() => handleRemoveLink(link.id)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-card border rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Vincular Case
            </h2>

            <div className="space-y-4">
              {/* Link Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Vínculo</label>
                <div className="flex flex-wrap gap-2">
                  {LINK_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedLinkType(type.value)}
                      className={cn(
                        "px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1",
                        selectedLinkType === type.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <type.icon className="h-3 w-3" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Buscar Case</label>
                <input
                  type="text"
                  placeholder="Digite ID ou título..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto">
                {loading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Buscando...
                  </p>
                )}
                {!loading && searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum case encontrado
                  </p>
                )}
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAddLink(c)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg text-left"
                  >
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">#{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.client_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm hover:bg-muted rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
