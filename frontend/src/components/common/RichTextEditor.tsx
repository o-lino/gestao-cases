import { useState, useRef, useEffect } from 'react'
import { Bold, Italic, List, ListOrdered, Link, Image, Code, Quote, Heading1, Heading2 } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: { message?: string }
  minHeight?: number
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  label,
  error,
  minHeight = 200,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Sync value to editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const insertLink = () => {
    const url = prompt('Digite a URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }

  const insertImage = () => {
    const url = prompt('Digite a URL da imagem:')
    if (url) {
      execCommand('insertImage', url)
    }
  }

  const ToolbarButton = ({
    onClick,
    children,
    title,
  }: {
    onClick: () => void
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      
      <div 
        className={`border rounded-lg overflow-hidden ${
          isFocused ? 'ring-2 ring-primary border-primary' : ''
        } ${error ? 'border-destructive' : ''}`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h1>')} title="Título 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h2>')} title="Título 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={() => execCommand('bold')} title="Negrito (Ctrl+B)">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('italic')} title="Itálico (Ctrl+I)">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Lista">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Lista Numerada">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<blockquote>')} title="Citação">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<pre>')} title="Código">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={insertLink} title="Inserir Link">
            <Link className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertImage} title="Inserir Imagem">
            <Image className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          data-placeholder={placeholder}
          className={`
            p-3 outline-none prose prose-sm dark:prose-invert max-w-none
            [&:empty]:before:content-[attr(data-placeholder)] 
            [&:empty]:before:text-muted-foreground
            [&:empty]:before:pointer-events-none
            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
            [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic
            [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_pre]:text-sm
            [&_a]:text-primary [&_a]:underline
            [&_img]:max-w-full [&_img]:rounded
          `}
          style={{ minHeight }}
        />
      </div>

      {error?.message && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  )
}
