import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Case } from '@/services/caseService'
import { Clock, ChevronRight } from 'lucide-react'

interface KanbanBoardProps {
  cases: Case[]
  onCaseClick?: (caseData: Case) => void
  onStatusChange?: (caseId: number, newStatus: string) => void
}

const COLUMNS = [
  { id: 'DRAFT', title: 'Rascunho', color: 'bg-yellow-500' },
  { id: 'SUBMITTED', title: 'Enviado', color: 'bg-blue-500' },
  { id: 'REVIEW', title: 'Em Revisão', color: 'bg-purple-500' },
  { id: 'APPROVED', title: 'Aprovado', color: 'bg-green-500' },
  { id: 'REJECTED', title: 'Rejeitado', color: 'bg-red-500' },
  { id: 'CLOSED', title: 'Fechado', color: 'bg-gray-500' },
]

function KanbanCard({ caseData }: { caseData: Case }) {
  return (
    <Link
      to={`/cases/${caseData.id}`}
      className="block p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {caseData.title}
        </h4>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {caseData.client_name && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {caseData.client_name}
        </p>
      )}
      
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        {caseData.created_at && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(caseData.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>
      
      {caseData.macro_case && (
        <div className="mt-2">
          <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
            {caseData.macro_case}
          </span>
        </div>
      )}
    </Link>
  )
}

function KanbanColumn({ 
  id: _id, 
  title, 
  color, 
  cases 
}: { 
  id: string
  title: string
  color: string
  cases: Case[]
}) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg">
      {/* Column Header */}
      <div className="p-3 border-b flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {cases.length}
        </span>
      </div>
      
      {/* Cards Container */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
        {cases.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum case
          </p>
        ) : (
          cases.map((c) => (
            <KanbanCard key={c.id} caseData={c} />
          ))
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({ cases, onCaseClick: _onCaseClick, onStatusChange: _onStatusChange }: KanbanBoardProps) {
  const groupedCases = useMemo(() => {
    const groups: Record<string, Case[]> = {}
    
    COLUMNS.forEach(col => {
      groups[col.id] = []
    })
    
    cases.forEach(c => {
      if (groups[c.status]) {
        groups[c.status].push(c)
      }
    })
    
    // Sort each column by created_at desc
    Object.keys(groups).forEach(status => {
      groups[status].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })
    
    return groups
  }, [cases])

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          id={column.id}
          title={column.title}
          color={column.color}
          cases={groupedCases[column.id] || []}
        />
      ))}
    </div>
  )
}
