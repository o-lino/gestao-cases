import { useState, useRef, useCallback, DragEvent } from 'react'
import { Upload, X, File, Image, FileText, Film, Music, Archive, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/common/Toast'

interface UploadedFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  url?: string
}

interface DragDropUploadProps {
  onUpload: (files: File[]) => Promise<{ url: string; filename: string }[]>
  accept?: string
  maxFiles?: number
  maxSizeMB?: number
  multiple?: boolean
}

const FILE_ICONS: Record<string, React.ComponentType<any>> = {
  image: Image,
  video: Film,
  audio: Music,
  pdf: FileText,
  text: FileText,
  archive: Archive,
  default: File,
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FILE_ICONS.image
  if (type.startsWith('video/')) return FILE_ICONS.video
  if (type.startsWith('audio/')) return FILE_ICONS.audio
  if (type === 'application/pdf') return FILE_ICONS.pdf
  if (type.startsWith('text/')) return FILE_ICONS.text
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return FILE_ICONS.archive
  return FILE_ICONS.default
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function DragDropUpload({
  onUpload,
  accept = '*/*',
  maxFiles = 10,
  maxSizeMB = 10,
  multiple = true,
}: DragDropUploadProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Arquivo muito grande (máx ${maxSizeMB}MB)`
    }
    return null
  }, [maxSizeMB])

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = []
    
    for (let i = 0; i < Math.min(fileList.length, maxFiles - files.length); i++) {
      const file = fileList[i]
      const error = validateFile(file)
      
      newFiles.push({
        id: `${Date.now()}-${i}`,
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      })
    }
    
    if (fileList.length > maxFiles - files.length) {
      toast.warning(`Limite de ${maxFiles} arquivos. Alguns foram ignorados.`)
    }

    setFiles(prev => [...prev, ...newFiles])

    // Upload valid files
    const validFiles = newFiles.filter(f => f.status === 'pending')
    if (validFiles.length === 0) return

    // Update status to uploading
    setFiles(prev => prev.map(f => 
      validFiles.find(v => v.id === f.id) ? { ...f, status: 'uploading' as const } : f
    ))

    try {
      const results = await onUpload(validFiles.map(f => f.file))
      
      // Update with success
      setFiles(prev => prev.map((f, i) => {
        const validIndex = validFiles.findIndex(v => v.id === f.id)
        if (validIndex >= 0 && results[validIndex]) {
          return { ...f, status: 'success' as const, progress: 100, url: results[validIndex].url }
        }
        return f
      }))
      
      toast.success(`${results.length} arquivo(s) enviado(s)`)
    } catch (error: any) {
      setFiles(prev => prev.map(f =>
        validFiles.find(v => v.id === f.id) 
          ? { ...f, status: 'error' as const, error: error.message }
          : f
      ))
      toast.error('Erro ao enviar arquivos')
    }
  }, [files.length, maxFiles, onUpload, toast, validateFile])

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const { files: droppedFiles } = e.dataTransfer
    if (droppedFiles?.length) {
      handleFiles(droppedFiles)
    }
  }, [handleFiles])

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDrag={handleDrag}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />
        
        <Upload className={cn(
          "h-12 w-12 mx-auto mb-4 transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground"
        )} />
        
        <p className="text-lg font-medium mb-1">
          {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
        </p>
        <p className="text-sm text-muted-foreground">
          Máximo {maxFiles} arquivos, até {maxSizeMB}MB cada
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {files.length} arquivo(s)
            </span>
            {files.some(f => f.status === 'success') && (
              <button
                onClick={clearCompleted}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          {files.map(file => {
            const Icon = getFileIcon(file.file.type)
            
            return (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg",
                  file.status === 'error' && "border-destructive/50 bg-destructive/5",
                  file.status === 'success' && "border-green-500/50 bg-green-500/5"
                )}
              >
                <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file.size)}
                    {file.error && (
                      <span className="text-destructive ml-2">• {file.error}</span>
                    )}
                  </p>
                  
                  {file.status === 'uploading' && (
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {file.status === 'uploading' && (
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  {(file.status === 'pending' || file.status === 'error') && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
