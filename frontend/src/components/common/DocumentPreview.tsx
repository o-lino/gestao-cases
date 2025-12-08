import { useState, useEffect } from 'react'
import { FileText, X, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentPreviewProps {
  url: string
  filename: string
  isOpen: boolean
  onClose: () => void
}

export function DocumentPreview({ url, filename, isOpen, onClose }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fileExtension = filename.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')
  const isPdf = fileExtension === 'pdf'
  const isText = ['txt', 'md', 'json', 'xml', 'csv'].includes(fileExtension || '')

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
    }
  }, [isOpen, url])

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      if (direction === 'in') return Math.min(prev + 25, 200)
      return Math.max(prev - 25, 50)
    })
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <div className={cn(
      "fixed z-50 flex flex-col bg-background",
      isFullscreen ? "inset-0" : "inset-4 md:inset-8 rounded-xl shadow-2xl border"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium truncate max-w-[200px] md:max-w-none">
            {filename}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="hidden md:flex items-center gap-1 border rounded-lg px-2 py-1">
            <button onClick={() => handleZoom('out')} className="p-1 hover:bg-muted rounded">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm w-12 text-center">{zoom}%</span>
            <button onClick={() => handleZoom('in')} className="p-1 hover:bg-muted rounded">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Rotate (for images) */}
          {isImage && (
            <button onClick={handleRotate} className="p-2 hover:bg-muted rounded-lg" title="Girar">
              <RotateCw className="h-4 w-4" />
            </button>
          )}

          {/* Page Navigation (for PDFs) */}
          {isPdf && totalPages > 1 && (
            <div className="hidden md:flex items-center gap-1 border rounded-lg px-2 py-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 hover:bg-muted rounded disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 hover:bg-muted rounded disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="p-2 hover:bg-muted rounded-lg" title="Tela cheia">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Download */}
          <button onClick={handleDownload} className="p-2 hover:bg-muted rounded-lg" title="Baixar">
            <Download className="h-4 w-4" />
          </button>

          {/* Close */}
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4">
        {loading && (
          <div className="text-center text-muted-foreground">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        )}

        {error && (
          <div className="text-center text-destructive p-4">
            <p className="font-medium">Erro ao carregar documento</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isImage && (
          <img
            src={url}
            alt={filename}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError('Falha ao carregar imagem')
            }}
            className={cn(
              "max-w-full max-h-full object-contain transition-transform",
              loading && "hidden"
            )}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            }}
          />
        )}

        {isPdf && (
          <iframe
            src={`${url}#page=${currentPage}`}
            title={filename}
            className="w-full h-full border-0"
            style={{ transform: `scale(${zoom / 100})` }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError('Falha ao carregar PDF')
            }}
          />
        )}

        {isText && (
          <TextPreview
            url={url}
            onLoad={() => setLoading(false)}
            onError={(e) => {
              setLoading(false)
              setError(e)
            }}
          />
        )}

        {!isImage && !isPdf && !isText && !loading && !error && (
          <div className="text-center text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Pré-visualização não disponível para este tipo de arquivo</p>
            <button
              onClick={handleDownload}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              Baixar arquivo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Text file preview component
function TextPreview({ url, onLoad, onError }: { url: string; onLoad: () => void; onError: (e: string) => void }) {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.text()
      })
      .then(text => {
        setContent(text)
        onLoad()
      })
      .catch(e => onError(e.message))
  }, [url])

  return (
    <pre className="w-full h-full overflow-auto p-4 bg-card rounded-lg text-sm font-mono whitespace-pre-wrap">
      {content}
    </pre>
  )
}

// Thumbnail component for document list
interface DocumentThumbnailProps {
  filename: string
  url: string
  onClick?: () => void
}

export function DocumentThumbnail({ filename, url, onClick }: DocumentThumbnailProps) {
  const fileExtension = filename.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')

  return (
    <button
      onClick={onClick}
      className="group relative w-16 h-16 rounded-lg border bg-muted/50 hover:border-primary transition-colors overflow-hidden"
    >
      {isImage ? (
        <img
          src={url}
          alt={filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </button>
  )
}
