import { useMemo } from 'react'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const html = useMemo(() => parseMarkdown(content), [content])
  
  return (
    <div 
      className={`prose prose-sm max-w-none dark:prose-invert ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function parseMarkdown(text: string): string {
  if (!text) return ''
  
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    
    // Bold and Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded" />')
    
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    .replace(/^\*\*\*$/gm, '<hr />')
    
    // Unordered lists
    .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
    
    // Ordered lists
    .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
    
    // Task lists
    .replace(/<li>\[x\] (.+)<\/li>/gi, '<li class="task-done">✓ $1</li>')
    .replace(/<li>\[ \] (.+)<\/li>/gi, '<li class="task-pending">○ $1</li>')
    
    // Wrap consecutive li elements in ul
    .replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>')
    
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hupob]|<li|<hr|<pre)(.+)$/gm, '<p>$1</p>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p>')

  // Fix nested blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br />')
  
  return html
}

// Simple markdown input with preview toggle
interface MarkdownInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function MarkdownInput({ value, onChange, placeholder, rows = 5 }: MarkdownInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Suporta Markdown</span>
        <div className="flex gap-2">
          <span>**negrito**</span>
          <span>*itálico*</span>
          <span>`código`</span>
          <span>[link](url)</span>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

// Preview component with markdown cheat sheet
export function MarkdownCheatSheet() {
  return (
    <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
      <p className="font-medium mb-2">Formatação Markdown:</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>**negrito** → <strong>negrito</strong></span>
        <span>*itálico* → <em>itálico</em></span>
        <span>`código` → <code className="bg-muted px-1 rounded">código</code></span>
        <span>~~riscado~~ → <del>riscado</del></span>
        <span>[texto](url) → link</span>
        <span># Título → Cabeçalho</span>
        <span>&gt; citação → bloco de citação</span>
        <span>- item → lista</span>
      </div>
    </div>
  )
}
