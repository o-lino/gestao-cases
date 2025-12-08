import { useMemo, useState } from 'react'
import { format, parseISO, differenceInDays, addDays, isWithinInterval, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Case } from '@/services/caseService'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimelineViewProps {
  cases: Case[]
  onCaseClick?: (caseId: number) => void
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-400',
  SUBMITTED: 'bg-blue-400',
  REVIEW: 'bg-purple-400',
  APPROVED: 'bg-green-400',
  REJECTED: 'bg-red-400',
  CLOSED: 'bg-gray-400',
}

export function TimelineView({ cases, onCaseClick }: TimelineViewProps) {
  const [zoom, setZoom] = useState(1) // days per cell
  const [viewStartDate, setViewStartDate] = useState(() => {
    const now = new Date()
    return addDays(now, -30)
  })

  const daysToShow = Math.floor(60 / zoom)
  const viewEndDate = addDays(viewStartDate, daysToShow)

  // Generate date columns
  const dateColumns = useMemo(() => {
    const columns = []
    for (let i = 0; i < daysToShow; i++) {
      columns.push(addDays(viewStartDate, i))
    }
    return columns
  }, [viewStartDate, daysToShow])

  // Filter and sort cases with dates
  const timelineCases = useMemo(() => {
    return cases
      .filter(c => c.start_date || c.created_at)
      .map(c => {
        const startDate = c.start_date ? parseISO(c.start_date) : new Date(c.created_at)
        const endDate = c.end_date ? parseISO(c.end_date) : addDays(startDate, 7)
        return { ...c, startDate, endDate }
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }, [cases])

  const getCasePosition = (caseData: { startDate: Date; endDate: Date }) => {
    const startOffset = Math.max(0, differenceInDays(caseData.startDate, viewStartDate))
    const endOffset = Math.min(daysToShow, differenceInDays(caseData.endDate, viewStartDate))
    
    if (endOffset < 0 || startOffset >= daysToShow) {
      return null // Case is not visible
    }

    return {
      left: `${(startOffset / daysToShow) * 100}%`,
      width: `${((endOffset - startOffset) / daysToShow) * 100}%`,
    }
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -14 : 14
    setViewStartDate(prev => addDays(prev, days))
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      if (direction === 'in') return Math.min(prev * 1.5, 4)
      return Math.max(prev / 1.5, 0.5)
    })
  }

  const goToToday = () => {
    setViewStartDate(addDays(new Date(), -30))
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigate('prev')}
            className="p-2 hover:bg-muted rounded-lg"
            title="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm border rounded-lg hover:bg-muted flex items-center gap-1"
          >
            <Calendar className="h-3 w-3" />
            Hoje
          </button>
          <button
            onClick={() => handleNavigate('next')}
            className="p-2 hover:bg-muted rounded-lg"
            title="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          {format(viewStartDate, 'dd/MM/yyyy')} - {format(viewEndDate, 'dd/MM/yyyy')}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom('out')}
            className="p-2 hover:bg-muted rounded-lg"
            title="Menos zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleZoom('in')}
            className="p-2 hover:bg-muted rounded-lg"
            title="Mais zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="border rounded-lg overflow-hidden">
        {/* Date Header */}
        <div className="flex border-b bg-muted/50 text-xs">
          <div className="w-48 shrink-0 p-2 font-medium border-r">Case</div>
          <div className="flex-1 flex">
            {dateColumns.map((date, i) => {
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const showLabel = i % Math.ceil(7 / zoom) === 0
              
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 text-center py-1 border-r border-b min-w-[30px]",
                    isToday && "bg-primary/10",
                    isWeekend && "bg-muted/30"
                  )}
                >
                  {showLabel && (
                    <div className="text-muted-foreground">
                      {format(date, 'dd/MM', { locale: ptBR })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Cases Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {timelineCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum case com datas definidas
            </div>
          ) : (
            timelineCases.map((caseData) => {
              const position = getCasePosition(caseData)
              
              return (
                <div key={caseData.id} className="flex border-b hover:bg-muted/50">
                  {/* Case Name */}
                  <div className="w-48 shrink-0 p-2 border-r">
                    <button
                      onClick={() => onCaseClick?.(caseData.id)}
                      className="text-sm font-medium truncate hover:text-primary text-left w-full"
                    >
                      {caseData.title}
                    </button>
                    <div className="text-xs text-muted-foreground truncate">
                      {caseData.client_name || 'Sem cliente'}
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="flex-1 relative h-14">
                    {/* Background Grid */}
                    <div className="absolute inset-0 flex">
                      {dateColumns.map((date, i) => {
                        const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex-1 border-r min-w-[30px]",
                              isToday && "bg-primary/5",
                              isWeekend && "bg-muted/20"
                            )}
                          />
                        )
                      })}
                    </div>

                    {/* Case Bar */}
                    {position && (
                      <div
                        className="absolute top-2 h-10 flex items-center"
                        style={{ left: position.left, width: position.width }}
                      >
                        <div
                          className={cn(
                            "h-8 w-full rounded-md shadow-sm flex items-center px-2 text-xs text-white font-medium truncate cursor-pointer hover:opacity-80",
                            STATUS_COLORS[caseData.status] || 'bg-gray-400'
                          )}
                          onClick={() => onCaseClick?.(caseData.id)}
                          title={`${caseData.title}\n${format(caseData.startDate, 'dd/MM')} - ${format(caseData.endDate, 'dd/MM')}`}
                        >
                          {caseData.title}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
