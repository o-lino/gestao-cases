import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FavoritesContextType {
  favorites: Set<number>
  isFavorite: (caseId: number) => boolean
  toggleFavorite: (caseId: number) => void
  getFavoritesList: () => number[]
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('caseFavorites')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  useEffect(() => {
    localStorage.setItem('caseFavorites', JSON.stringify([...favorites]))
  }, [favorites])

  const isFavorite = (caseId: number) => favorites.has(caseId)

  const toggleFavorite = (caseId: number) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(caseId)) {
        next.delete(caseId)
      } else {
        next.add(caseId)
      }
      return next
    })
  }

  const getFavoritesList = () => [...favorites]

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, getFavoritesList }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return context
}

interface FavoriteButtonProps {
  caseId: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function FavoriteButton({ caseId, size = 'md', showLabel = false }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const isFav = isFavorite(caseId)

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(caseId)
      }}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        isFav 
          ? "text-yellow-500 hover:text-yellow-600" 
          : "text-muted-foreground hover:text-yellow-500"
      )}
      title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <Star className={cn(sizeClasses[size], isFav && "fill-current")} />
      {showLabel && (
        <span className="text-xs">{isFav ? 'Favoritado' : 'Favoritar'}</span>
      )}
    </button>
  )
}

// Filter component for favorites
interface FavoritesFilterProps {
  showOnlyFavorites: boolean
  onToggle: (show: boolean) => void
}

export function FavoritesFilter({ showOnlyFavorites, onToggle }: FavoritesFilterProps) {
  const { favorites } = useFavorites()
  
  return (
    <button
      onClick={() => onToggle(!showOnlyFavorites)}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors",
        showOnlyFavorites
          ? "bg-yellow-50 border-yellow-300 text-yellow-700"
          : "hover:bg-muted"
      )}
    >
      <Star className={cn("h-4 w-4", showOnlyFavorites && "fill-yellow-500 text-yellow-500")} />
      <span className="text-sm">
        Favoritos ({favorites.size})
      </span>
    </button>
  )
}
