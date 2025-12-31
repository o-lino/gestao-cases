/**
 * AIInsightsTab Component
 * Displays AI-generated summary and risk assessment for a case
 */

import { useState, useEffect } from 'react'
import { caseService, Case } from '@/services/caseService'

interface AIInsightsTabProps {
  caseData: Case
}

interface RiskAssessment {
  risk_score: number
  risk_level: 'BAIXO' | 'MÉDIO' | 'ALTO'
  factors?: string[]
}

export function AIInsightsTab({ caseData }: AIInsightsTabProps) {
  const [summary, setSummary] = useState<string>('')
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAIInsights()
  }, [caseData.id])

  const loadAIInsights = async () => {
    setLoading(true)
    try {
      const [summaryData, riskData] = await Promise.all([
        caseService.getSummary(caseData.id),
        caseService.getRiskAssessment(caseData.id)
      ])
      setSummary(summaryData.summary || 'Resumo não disponível')
      setRiskAssessment(riskData)
    } catch (error) {
      console.error('Failed to load AI insights', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando análise de IA...</div>
      </div>
    )
  }

  const riskScore = riskAssessment?.risk_score || 0
  const riskLevel = riskAssessment?.risk_level || 'BAIXO'
  const riskColor = riskLevel === 'ALTO' ? 'text-red-600' : riskLevel === 'MÉDIO' ? 'text-yellow-600' : 'text-green-600'
  const riskBgColor = riskLevel === 'ALTO' ? 'bg-red-600' : riskLevel === 'MÉDIO' ? 'bg-yellow-600' : 'bg-green-600'

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">🤖</span> Resumo Inteligente
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerado automaticamente pela IaraGenAI
            </p>
            <div className="bg-muted/50 p-4 rounded-md text-sm leading-relaxed">
              {summary}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📊</span> Análise de Risco
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score de Risco</span>
              <span className={`text-2xl font-bold ${riskColor}`}>{riskScore}/100</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${riskBgColor}`} 
                style={{ width: `${riskScore}%` }}
              ></div>
            </div>

            {riskAssessment?.factors && riskAssessment.factors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Fatores Identificados:</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {riskAssessment.factors.map((factor, index) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
