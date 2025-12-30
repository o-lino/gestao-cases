import { useEffect, useState } from 'react'
import { caseService, Case } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { Activity, Briefcase, Users, Clock, PieChart, Filter, TrendingUp, ArrowUpRight, Loader2 } from 'lucide-react'
import { CaseStatusChart, CaseTrendChart, CaseBarChart } from '@/components/charts'
import { format, subDays, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'

type PeriodFilter = '7d' | '30d' | '90d' | 'all'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'hsl(45, 93%, 47%)',
  SUBMITTED: 'hsl(210, 100%, 50%)',
  REVIEW: 'hsl(280, 100%, 60%)',
  APPROVED: 'hsl(142, 76%, 36%)',
  REJECTED: 'hsl(0, 84%, 60%)',
  CLOSED: 'hsl(220, 9%, 46%)',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviado',
  REVIEW: 'Em Revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CLOSED: 'Fechado',
}

export function Dashboard() {
  const { user } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    mine: 0,
    recentActivity: 0,
    approvalRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [user, period])

  const getDateFilter = () => {
    const now = new Date()
    switch (period) {
      case '7d': return subDays(now, 7)
      case '30d': return subDays(now, 30)
      case '90d': return subDays(now, 90)
      default: return null
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const allCases = await caseService.getAll()
      
      if (!Array.isArray(allCases)) {
        throw new Error('Invalid response format')
      }

      const filterDate = getDateFilter()
      const filteredCases = filterDate 
        ? allCases.filter(c => {
            const caseDate = c.created_at ? new Date(c.created_at) : new Date()
            return caseDate >= filterDate
          })
        : allCases

      setCases(filteredCases)

      const activeCount = filteredCases.filter(c => !['CLOSED', 'REJECTED'].includes(c.status)).length
      const myCases = filteredCases.filter(c => c.requester_email === user?.email).length
      const recentCount = filteredCases.filter(c => {
        const caseDate = c.created_at ? new Date(c.created_at) : new Date()
        return caseDate >= subDays(new Date(), 7)
      }).length

      const closedCases = filteredCases.filter(c => ['APPROVED', 'REJECTED', 'CLOSED'].includes(c.status))
      const approvedCases = filteredCases.filter(c => c.status === 'APPROVED')
      const approvalRate = closedCases.length > 0 
        ? (approvedCases.length / closedCases.length) * 100 
        : 0

      setStats({
        total: filteredCases.length,
        active: activeCount,
        mine: myCases,
        recentActivity: recentCount,
        approvalRate,
      })
    } catch (error: any) {
      console.error('Failed to load dashboard data', error)
      setError('Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data
  const getStatusChartData = () => {
    const statusCounts: Record<string, number> = {}
    cases.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
    })
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || 'hsl(220, 9%, 46%)',
    }))
  }

  const getTrendChartData = () => {
    const dateMap: Record<string, { cases: number; approved: number }> = {}
    
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'dd/MM')
      dateMap[date] = { cases: 0, approved: 0 }
    }

    cases.forEach(c => {
      if (c.created_at) {
        const date = format(new Date(c.created_at), 'dd/MM')
        if (dateMap[date]) {
          dateMap[date].cases++
          if (c.status === 'APPROVED') {
            dateMap[date].approved++
          }
        }
      }
    })

    return Object.entries(dateMap).map(([date, data]) => ({
      date,
      ...data,
    }))
  }

  const getClientChartData = () => {
    const clientCounts: Record<string, number> = {}
    cases.forEach(c => {
      const client = c.client_name || 'Não especificado'
      clientCounts[client] = (clientCounts[client] || 0) + 1
    })
    
    return Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-gray-500">Carregando dados...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Bem-vindo, {user?.name?.split(' ')[0] || 'Usuário'}!</h1>
            <p className="text-white/80 mt-1">Aqui está o resumo do seu sistema de gestão de cases</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            <Filter className="h-4 w-4" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="7d" className="text-gray-900">Últimos 7 dias</option>
              <option value="30d" className="text-gray-900">Últimos 30 dias</option>
              <option value="90d" className="text-gray-900">Últimos 90 dias</option>
              <option value="all" className="text-gray-900">Todo período</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">cases no período</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Ativos</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.active}</p>
          <p className="text-sm text-gray-500 mt-1">em andamento</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Meus</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.mine}</p>
          <p className="text-sm text-gray-500 mt-1">criados por você</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Recente</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.recentActivity}</p>
          <p className="text-sm text-gray-500 mt-1">últimos 7 dias</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Taxa</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats.approvalRate.toFixed(0)}%</p>
          <p className="text-sm text-gray-500 mt-1">aprovação</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-800">Evolução de Cases</h3>
              <p className="text-sm text-gray-500">Criação ao longo do tempo</p>
            </div>
          </div>
          <CaseTrendChart data={getTrendChartData()} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-800">Distribuição por Status</h3>
              <p className="text-sm text-gray-500">Cases por status atual</p>
            </div>
          </div>
          <CaseStatusChart data={getStatusChartData()} />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-800">Top 5 Clientes</h3>
              <p className="text-sm text-gray-500">Com mais cases</p>
            </div>
          </div>
          <CaseBarChart data={getClientChartData()} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-800">Últimos Cases</h3>
              <p className="text-sm text-gray-500">Recentemente criados</p>
            </div>
            <Link 
              to="/cases" 
              className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {cases.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-orange-600 transition-colors">{c.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.client_name || 'Sem cliente'}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                  c.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  c.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                  c.status === 'REVIEW' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
              </Link>
            ))}
            {cases.length === 0 && (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">Nenhum case encontrado no período</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
