import { useState, useCallback } from 'react'
import { MessageSquare, Reply, MoreVertical, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MentionInput, MentionText } from '@/components/common/MentionInput'
import { MarkdownContent } from '@/components/common/MarkdownRenderer'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export interface Comment {
  id: number
  content: string
  created_by: number
  author_name: string
  author_email: string
  created_at: string
  updated_at?: string
  parent_id?: number
  replies?: Comment[]
}

interface CommentThreadProps {
  comments: Comment[]
  onAddComment: (content: string, parentId?: number) => Promise<void>
  onEditComment?: (commentId: number, content: string) => Promise<void>
  onDeleteComment?: (commentId: number) => Promise<void>
  loading?: boolean
}

export function CommentThread({
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  loading = false,
}: CommentThreadProps) {
  const { user } = useAuth()
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(new Set())

  // Organize comments into threads
  const rootComments = comments.filter(c => !c.parent_id)
  const repliesMap = new Map<number, Comment[]>()
  comments.forEach(c => {
    if (c.parent_id) {
      const replies = repliesMap.get(c.parent_id) || []
      replies.push(c)
      repliesMap.set(c.parent_id, replies)
    }
  })

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      await onAddComment(newComment)
      setNewComment('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: number) => {
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)
    try {
      await onAddComment(replyContent, parentId)
      setReplyContent('')
      setReplyingTo(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: number) => {
    if (!editContent.trim() || !onEditComment) return
    setSubmitting(true)
    try {
      await onEditComment(commentId, editContent)
      setEditingId(null)
      setEditContent('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: number) => {
    if (!onDeleteComment || !confirm('Excluir este comentário?')) return
    await onDeleteComment(commentId)
  }

  const toggleThread = (commentId: number) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const replies = repliesMap.get(comment.id) || []
    const isCollapsed = collapsedThreads.has(comment.id)
    const isEditing = editingId === comment.id
    const isReplying = replyingTo === comment.id
    const isOwner = user?.email === comment.author_email

    return (
      <div className={cn("space-y-2", depth > 0 && "ml-6 pl-4 border-l-2 border-muted")}>
        <div className="bg-card rounded-lg p-3 border">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {comment.author_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <span className="font-medium text-sm">{comment.author_name || 'Usuário'}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <span className="text-xs text-muted-foreground ml-1">(editado)</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {replies.length > 0 && (
                <button
                  onClick={() => toggleThread(comment.id)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  title={isCollapsed ? 'Expandir respostas' : 'Recolher respostas'}
                >
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  <span className="text-xs ml-0.5">{replies.length}</span>
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      setEditingId(comment.id)
                      setEditContent(comment.content)
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 text-sm hover:bg-muted rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleEdit(comment.id)}
                  disabled={submitting}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm prose prose-sm max-w-none">
              <MentionText text={comment.content} />
            </div>
          )}

          {/* Reply Button */}
          {!isEditing && depth < 3 && (
            <button
              onClick={() => {
                setReplyingTo(isReplying ? null : comment.id)
                setReplyContent('')
              }}
              className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              {isReplying ? 'Cancelar' : 'Responder'}
            </button>
          )}

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-3 space-y-2">
              <MentionInput
                value={replyContent}
                onChange={setReplyContent}
                placeholder="Escreva sua resposta..."
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={submitting || !replyContent.trim()}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
                >
                  Responder
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nested Replies */}
        {!isCollapsed && replies.length > 0 && (
          <div className="space-y-2">
            {replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* New Comment Input */}
      <div className="space-y-2">
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          placeholder="Escreva um comentário... Use @ para mencionar"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            {submitting ? 'Enviando...' : 'Comentar'}
          </button>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando comentários...
        </div>
      ) : rootComments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum comentário ainda. Seja o primeiro!
        </div>
      ) : (
        <div className="space-y-4">
          {rootComments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  )
}
