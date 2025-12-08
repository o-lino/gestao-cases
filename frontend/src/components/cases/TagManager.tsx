import { useState } from 'react'
import { Tag, Plus, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CaseTag {
  id: string
  name: string
  color: string
}

const PRESET_COLORS = [
  { name: 'red', value: 'bg-red-500' },
  { name: 'orange', value: 'bg-orange-500' },
  { name: 'yellow', value: 'bg-yellow-500' },
  { name: 'green', value: 'bg-green-500' },
  { name: 'teal', value: 'bg-teal-500' },
  { name: 'blue', value: 'bg-blue-500' },
  { name: 'indigo', value: 'bg-indigo-500' },
  { name: 'purple', value: 'bg-purple-500' },
  { name: 'pink', value: 'bg-pink-500' },
  { name: 'gray', value: 'bg-gray-500' },
]

const DEFAULT_TAGS: CaseTag[] = [
  { id: 'tag-urgent', name: 'Urgente', color: 'bg-red-500' },
  { id: 'tag-strategic', name: 'Estratégico', color: 'bg-purple-500' },
  { id: 'tag-client', name: 'Cliente-Chave', color: 'bg-blue-500' },
  { id: 'tag-innovation', name: 'Inovação', color: 'bg-green-500' },
  { id: 'tag-review', name: 'Revisão Necessária', color: 'bg-yellow-500' },
]

interface TagManagerProps {
  selectedTags: CaseTag[]
  onTagsChange: (tags: CaseTag[]) => void
  readonly?: boolean
}

export function TagManager({ selectedTags, onTagsChange, readonly = false }: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableTags, setAvailableTags] = useState<CaseTag[]>(() => {
    const saved = localStorage.getItem('caseTags')
    return saved ? [...DEFAULT_TAGS, ...JSON.parse(saved)] : DEFAULT_TAGS
  })
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0].value)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleAddTag = (tag: CaseTag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag])
    }
    setIsOpen(false)
  }

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTags.filter(t => t.id !== tagId))
  }

  const handleCreateTag = () => {
    if (!newTagName.trim()) return
    
    const newTag: CaseTag = {
      id: `custom-tag-${Date.now()}`,
      name: newTagName.trim(),
      color: newTagColor,
    }
    
    // Save to available tags
    const customTags = availableTags.filter(t => !t.id.startsWith('tag-'))
    localStorage.setItem('caseTags', JSON.stringify([...customTags, newTag]))
    setAvailableTags(prev => [...prev, newTag])
    
    // Add to selected
    onTagsChange([...selectedTags, newTag])
    
    // Reset form
    setNewTagName('')
    setShowCreateForm(false)
    setIsOpen(false)
  }

  const unselectedTags = availableTags.filter(
    tag => !selectedTags.find(st => st.id === tag.id)
  )

  if (readonly) {
    return (
      <div className="flex flex-wrap gap-1">
        {selectedTags.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sem tags</span>
        ) : (
          selectedTags.map(tag => (
            <span
              key={tag.id}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white",
                tag.color
              )}
            >
              {tag.name}
            </span>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Selected Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white",
              tag.color
            )}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 border border-dashed rounded-full text-xs hover:bg-muted"
        >
          <Plus className="h-3 w-3" />
          Adicionar Tag
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-64 bg-card border rounded-lg shadow-lg z-50 p-2">
            {/* Available Tags */}
            <div className="max-h-40 overflow-y-auto mb-2">
              {unselectedTags.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Todas as tags já foram adicionadas
                </p>
              ) : (
                unselectedTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                  >
                    <span className={cn("w-3 h-3 rounded-full", tag.color)} />
                    <span className="text-sm">{tag.name}</span>
                  </button>
                ))
              )}
            </div>

            {/* Create New */}
            <div className="border-t pt-2">
              {showCreateForm ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nome da tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded"
                    autoFocus
                  />
                  <div className="flex gap-1 flex-wrap">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color.name}
                        onClick={() => setNewTagColor(color.value)}
                        className={cn(
                          "w-5 h-5 rounded-full",
                          color.value,
                          newTagColor === color.value && "ring-2 ring-offset-2 ring-primary"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                      className="flex-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded disabled:opacity-50"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-sm text-primary hover:bg-muted rounded"
                >
                  <Tag className="h-3 w-3" />
                  Criar nova tag
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Display only component for case list/detail
export function TagBadges({ tags }: { tags: CaseTag[] }) {
  if (!tags || tags.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <span
          key={tag.id}
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs text-white",
            tag.color
          )}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}
