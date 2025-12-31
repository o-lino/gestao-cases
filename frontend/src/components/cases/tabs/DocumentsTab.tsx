/**
 * DocumentsTab Component
 * Displays and allows upload of case documents
 */

import { useState, useEffect } from 'react'
import { FileText, Upload } from 'lucide-react'
import { caseService, CaseDocument } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'

interface DocumentsTabProps {
  caseId: number
}

export function DocumentsTab({ caseId }: DocumentsTabProps) {
  const toast = useToast()
  const [documents, setDocuments] = useState<CaseDocument[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [caseId])

  const loadDocuments = async () => {
    try {
      const data = await caseService.getDocuments(caseId)
      setDocuments(data)
    } catch (error) {
      console.error('Failed to load documents', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await caseService.uploadDocument(caseId, file)
      await loadDocuments()
    } catch (error) {
      console.error('Failed to upload document', error)
      toast.error('Erro ao enviar documento')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-foreground">Documentos</h3>
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={cn(
                "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Enviar Documento'}
            </label>
          </div>
        </div>
        
        {documents.length > 0 ? (
          <ul role="list" className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                <div className="flex w-0 flex-1 items-center">
                  <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="ml-2 w-0 flex-1 truncate">{doc.filename}</span>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <span className="font-medium text-indigo-600 hover:text-indigo-500">
                    {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum documento enviado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
