import { useMemo } from 'react'
import { format, subDays, startOfDay, eachDayOfInterval, getDay, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Case } from '@/services/caseService'
import { cn } from '@/lib/utils'

interface ActivityHeatmapProps {
  cases: Case[]
  weeks?: number
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function ActivityHeatmap({ cases, weeks = 12 }: ActivityHeatmapProps) {
  const { grid, maxCount, totalActivity } = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, weeks * 7)
    
    // Count activities per day
    const activityMap = new Map<string, number>()
    
    cases.forEach(c => {
      if (c.created_at) {
        const dateKey = format(new Date(c.created_at), 'yyyy-MM-dd')
        activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1)
      }
      if (c.updated_at && c.updated_at !== c.created_at) {
        const dateKey = format(new Date(c.updated_at), 'yyyy-MM-dd')
        activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1)
      }
    })
    
    // Get max count for color scaling
    const maxCount = Math.max(...activityMap.values(), 1)
    const totalActivity = [...activityMap.values()].reduce((a, b) => a + b, 0)
    
    // Generate weeks grid
    const allDays = eachDayOfInterval({ start: startDate, end: endDate })
    
    // Group by weeks
    const weeksData: Array<Array<{ date: Date; count: number; dateKey: string }>> = []
    let currentWeek: Array<{ date: Date; count: number; dateKey: string }> = []
    
    allDays.forEach((day, index) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const count = activityMap.get(dateKey) || 0
      
      currentWeek.push({ date: day, count, dateKey })
      
      if (getDay(day) === 6 || index === allDays.length - 1) {
        weeksData.push(currentWeek)
        currentWeek = []
      }
    })
    
    return { grid: weeksData, maxCount, totalActivity }
  }, [cases, weeks])

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-muted'
    const intensity = count / maxCount
    if (intensity <= 0.25) return 'bg-green-200 dark:bg-green-900'
    if (intensity <= 0.5) return 'bg-green-400 dark:bg-green-700'
    if (intensity <= 0.75) return 'bg-green-500 dark:bg-green-600'
    return 'bg-green-600 dark:bg-green-500'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Atividade</h3>
        <span className="text-sm text-muted-foreground">
          {totalActivity} atividades nos últimos {weeks * 7} dias
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground pr-2">
            {DAYS_OF_WEEK.map((day, i) => (
              <div key={day} className="h-3 flex items-center" style={{ height: '12px' }}>
                {i % 2 === 1 && day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {grid.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const dayData = week.find(d => getDay(d.date) === dayIndex)
                
                if (!dayData) {
                  return <div key={dayIndex} className="w-3 h-3" />
                }
                
                return (
                  <div
                    key={dayData.dateKey}
                    className={cn(
                      "w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-125",
                      getColorClass(dayData.count)
                    )}
                    title={`${format(dayData.date, 'dd/MM/yyyy')}: ${dayData.count} atividade(s)`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Menos</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
          <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" />
          <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
        </div>
        <span>Mais</span>
      </div>
    </div>
  )
}
