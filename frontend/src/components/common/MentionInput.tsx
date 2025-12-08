import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: number
  name: string
  email: string
  avatar?: string
}

// Mock users for demo - in production, fetch from API
const MOCK_USERS: User[] = [
  { id: 1, name: 'Admin User', email: 'admin@example.com' },
  { id: 2, name: 'Manager User', email: 'manager@example.com' },
  { id: 3, name: 'Regular User', email: 'user@example.com' },
  { id: 4, name: 'Reviewer User', email: 'reviewer@example.com' },
]

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onMention?: (user: User) => void
  placeholder?: string
  className?: string
  rows?: number
}

export function MentionInput({
  value,
  onChange,
  onMention,
  placeholder = 'Digite seu comentário... Use @ para mencionar',
  className,
  rows = 3,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [users] = useState<User[]>(MOCK_USERS)

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0
    
    onChange(newValue)
    
    // Check for @ mentions
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      
      // Check if we're in a valid mention context (no space after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 20) {
        setMentionStart(lastAtIndex)
        setMentionQuery(textAfterAt)
        setShowSuggestions(true)
        setSuggestionIndex(0)
        return
      }
    }
    
    setShowSuggestions(false)
    setMentionQuery('')
    setMentionStart(-1)
  }

  const insertMention = (user: User) => {
    if (mentionStart === -1) return
    
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + mentionQuery.length + 1)
    const mention = `@${user.name} `
    
    const newValue = before + mention + after
    onChange(newValue)
    
    setShowSuggestions(false)
    setMentionQuery('')
    setMentionStart(-1)
    
    onMention?.(user)
    
    // Focus back and move cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + mention.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSuggestionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        )
        break
      case 'Enter':
        if (filteredUsers[suggestionIndex]) {
          e.preventDefault()
          insertMention(filteredUsers[suggestionIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  // Parse value for display with highlighted mentions
  const parseMentions = (text: string) => {
    const mentionRegex = /@[\w\s]+(?=\s|$)/g
    const parts = []
    let lastIndex = 0
    let match
    
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }
      parts.push({ type: 'mention', content: match[0] })
      lastIndex = match.index + match[0].length
    }
    
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) })
    }
    
    return parts
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "w-full px-3 py-2 border rounded-lg bg-background resize-none",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
          className
        )}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted",
                index === suggestionIndex && "bg-muted"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <span className="text-sm font-medium text-primary">
                    {user.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Hint */}
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <AtSign className="h-3 w-3" />
        <span>Use @ para mencionar alguém</span>
      </div>
    </div>
  )
}

// Display component for parsed mentions
export function MentionText({ text }: { text: string }) {
  const mentionRegex = /@[\w\s]+(?=\s|$)/g
  const parts: JSX.Element[] = []
  let lastIndex = 0
  let match
  let keyIndex = 0
  
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={keyIndex++}>{text.slice(lastIndex, match.index)}</span>
      )
    }
    parts.push(
      <span
        key={keyIndex++}
        className="bg-primary/10 text-primary px-1 rounded font-medium"
      >
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={keyIndex++}>{text.slice(lastIndex)}</span>)
  }
  
  return <>{parts}</>
}
