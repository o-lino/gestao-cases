/**
 * CommentsTab Component
 * Displays and allows adding comments to a case
 */

import { useState, useEffect } from 'react'
import { User as UserIcon } from 'lucide-react'
import { caseService, CaseComment } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'

interface CommentsTabProps {
  caseId: number
}

export function CommentsTab({ caseId }: CommentsTabProps) {
  const toast = useToast()
  const [comments, setComments] = useState<CaseComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [caseId])

  const loadComments = async () => {
    try {
      const data = await caseService.getComments(caseId)
      setComments(data)
    } catch (error) {
      console.error('Failed to load comments', error)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      await caseService.createComment(caseId, newComment)
      setNewComment('')
      await loadComments()
    } catch (error) {
      console.error('Failed to add comment', error)
      toast.error('Erro ao adicionar comentário')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <form onSubmit={handleAddComment} className="mb-6">
          <label htmlFor="comment" className="sr-only">Adicionar comentário</label>
          <div className="flex gap-4">
            <textarea
              id="comment"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 self-end"
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum comentário ainda.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-gray-500" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{comment.author_name || `Usuário ${comment.author_id}`}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
