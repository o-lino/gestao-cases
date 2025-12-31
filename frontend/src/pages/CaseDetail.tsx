import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Eye,
  MessageSquare,
  History,
  Sparkles,
  Database,
  AlertTriangle,
  ChevronDown,
  XCircle,
} from "lucide-react";
import { caseService, Case } from "@/services/caseService";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/common/Toast";
import { cn } from "@/lib/utils";

import {
  OverviewTab,
  DocumentsTab,
  CommentsTab,
  HistoryTab,
  AIInsightsTab,
  VariablesTab,
} from "@/components/cases/tabs";

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (id) {
      loadCase(parseInt(id));
    }
  }, [id]);

  const loadCase = async (caseId: number) => {
    try {
      const data = await caseService.getById(caseId);
      setCaseData(data);
    } catch (error) {
      console.error("Failed to load case", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!caseData) return;
    try {
      // Use transition instead of updateStatus based on caseService definition
      await caseService.transition(caseData.id, newStatus);
      toast.success(
        `Status alterado para ${
          newStatus === "CLOSED"
            ? "Fechado"
            : newStatus === "CANCELLED"
            ? "Cancelado"
            : newStatus
        }`
      );
      loadCase(caseData.id);
    } catch (error: any) {
      console.error("Failed to update status", error);
      toast.error(error?.response?.data?.detail || "Erro ao alterar status");
    }
  };

  const handleCancelCase = async () => {
    if (!caseData) return;
    setIsCancelling(true);
    try {
      await caseService.cancel(caseData.id, cancelReason || undefined);
      toast.success("Case cancelado com sucesso!");
      setShowCancelModal(false);
      setCancelReason("");
      loadCase(caseData.id);
    } catch (error: any) {
      console.error("Failed to cancel case", error);
      toast.error(error?.response?.data?.detail || "Erro ao cancelar case");
    } finally {
      setIsCancelling(false);
    }
  };

  // Calculate if case can be closed (all active variables must be approved)
  const activeVariables =
    caseData?.variables?.filter((v) => !v.is_cancelled) || [];
  const allVariablesApproved =
    activeVariables.length === 0 ||
    activeVariables.every((v) => v.search_status === "APPROVED");
  const pendingVariablesCount = activeVariables.filter(
    (v) => v.search_status !== "APPROVED"
  ).length;

  const canApprove = user?.role === "ADMIN" || user?.role === "MANAGER";

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold">Case não encontrado</h2>
        <Link to="/cases" className="text-primary hover:underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/cases"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {caseData.title}
            </h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <span>Case #{caseData.id}</span>
              <span>•</span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent 
                ${
                  caseData.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : caseData.status === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : caseData.status === "CLOSED"
                    ? "bg-gray-100 text-gray-800"
                    : caseData.status === "CANCELLED"
                    ? "bg-red-200 text-red-900"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {caseData.status === "DRAFT" && "Rascunho"}
                {caseData.status === "SUBMITTED" && "Enviado"}
                {caseData.status === "REVIEW" && "Em Revisão"}
                {caseData.status === "APPROVED" && "Aprovado"}
                {caseData.status === "REJECTED" && "Rejeitado"}
                {caseData.status === "CLOSED" && "Fechado"}
                {caseData.status === "CANCELLED" && "Cancelado"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {caseData.status === "DRAFT" && (
            <button
              onClick={() => handleStatusChange("SUBMITTED")}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Enviar para Revisão
            </button>
          )}
          {caseData.status === "SUBMITTED" && canApprove && (
            <button
              onClick={() => handleStatusChange("REVIEW")}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Iniciar Revisão
            </button>
          )}
          {caseData.status === "REVIEW" && canApprove && (
            <>
              <button
                onClick={() => handleStatusChange("APPROVED")}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2"
              >
                Aprovar
              </button>
              <button
                onClick={() => handleStatusChange("REJECTED")}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2"
              >
                Rejeitar
              </button>
            </>
          )}
          {caseData.status === "REJECTED" && (
            <button
              onClick={() => handleStatusChange("DRAFT")}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-yellow-600 text-white hover:bg-yellow-700 h-10 px-4 py-2"
            >
              Reabrir para Edição
            </button>
          )}
          {caseData.status === "APPROVED" && canApprove && (
            <div className="relative group">
              <button
                onClick={() =>
                  allVariablesApproved && handleStatusChange("CLOSED")
                }
                disabled={!allVariablesApproved}
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 py-2",
                  allVariablesApproved
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                )}
              >
                Fechar Case
              </button>
              {!allVariablesApproved && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {pendingVariablesCount} variável(eis) não aprovada(s)
                </div>
              )}
            </div>
          )}
          {/* Cancel Case Button - available for all statuses except CLOSED and CANCELLED */}
          {caseData.status !== "CLOSED" && caseData.status !== "CANCELLED" && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-red-300 text-red-600 hover:bg-red-50 h-10 px-4 py-2 gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancelar Case
            </button>
          )}
        </div>
      </div>

      {/* Cancel Case Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold">Cancelar Case</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Tem certeza que deseja cancelar o case{" "}
              <strong>{caseData.title}</strong>? Esta ação irá cancelar
              automaticamente todas as variáveis ativas.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Motivo do cancelamento (opcional):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                placeholder="Descreva o motivo do cancelamento..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelCase}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isCancelling ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Mobile: Dropdown elegante */}
        <div className="md:hidden">
          <label htmlFor="tabs-mobile" className="sr-only">
            Selecionar seção
          </label>
          <div className="relative">
            <select
              id="tabs-mobile"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
              className="block w-full appearance-none rounded-lg border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-gray-900 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="overview">📋 Visão Geral</option>
              <option value="variables">📊 Variáveis</option>
              <option value="documents">📁 Documentos</option>
              <option value="comments">💬 Comentários</option>
              <option value="history">🕐 Histórico</option>
              <option value="ai-insights">✨ IA Insights</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* Desktop: Tabs tradicionais */}
        <div className="hidden md:block border-b border-gray-200">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <Eye className="h-4 w-4" />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab("variables")}
              className={cn(
                activeTab === "variables"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <Database className="h-4 w-4" />
              Variáveis
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={cn(
                activeTab === "documents"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <FileText className="h-4 w-4" />
              Documentos
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={cn(
                activeTab === "comments"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Comentários
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                activeTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <History className="h-4 w-4" />
              Histórico
            </button>
            <button
              onClick={() => setActiveTab("ai-insights")}
              className={cn(
                activeTab === "ai-insights"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
              )}
            >
              <Sparkles className="h-4 w-4" />
              IA Insights
            </button>
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === "overview" && <OverviewTab caseData={caseData} />}
          {activeTab === "variables" && (
            <VariablesTab
              variables={caseData.variables}
              caseId={caseData.id}
              caseStatus={caseData.status}
              userId={user?.id}
              caseCreatedById={caseData.created_by}
              onUpdate={() => loadCase(caseData.id)}
            />
          )}
          {activeTab === "documents" && <DocumentsTab caseId={caseData.id} />}
          {activeTab === "comments" && <CommentsTab caseId={caseData.id} />}
          {activeTab === "history" && <HistoryTab caseId={caseData.id} />}
          {activeTab === "ai-insights" && <AIInsightsTab caseData={caseData} />}
        </div>
      </div>
    </div>
  );
}

// OverviewTab moved to @/components/cases/tabs/OverviewTab.tsx

// VariablesTab moved to @/components/cases/tabs/VariablesTab.tsx

// DocumentsTab moved to @/components/cases/tabs/DocumentsTab.tsx

// CommentsTab moved to @/components/cases/tabs/CommentsTab.tsx

// HistoryTab moved to @/components/cases/tabs/HistoryTab.tsx

// AIInsightsTab moved to @/components/cases/tabs/AIInsightsTab.tsx
