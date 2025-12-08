import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendData {
  date: string
  cases: number
  approved: number
}

interface CaseTrendChartProps {
  data: TrendData[]
}

export function CaseTrendChart({ data }: CaseTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(222.2, 47.4%, 11.2%)" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="hsl(222.2, 47.4%, 11.2%)" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Area 
          type="monotone" 
          dataKey="cases" 
          stroke="hsl(222.2, 47.4%, 11.2%)" 
          fillOpacity={1} 
          fill="url(#colorCases)" 
          name="Total de Cases"
        />
        <Area 
          type="monotone" 
          dataKey="approved" 
          stroke="hsl(142, 76%, 36%)" 
          fillOpacity={1} 
          fill="url(#colorApproved)" 
          name="Aprovados"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
