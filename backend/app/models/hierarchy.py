"""
Organizational Hierarchy Models
Defines the hierarchical structure for approval workflows and escalation
"""

from enum import IntEnum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class JobLevel(IntEnum):
    """Job levels for organizational hierarchy - used for escalation limits"""
    ANALYST = 1
    SPECIALIST = 2
    COORDINATOR = 3
    MANAGER = 4
    SENIOR_MANAGER = 5
    DIRECTOR = 6  # Maximum escalation level by default
    SENIOR_DIRECTOR = 7
    VP = 8
    
    @classmethod
    def get_label(cls, level: int) -> str:
        """Get human-readable label for job level"""
        labels = {
            1: "Analista",
            2: "Especialista",
            3: "Coordenador",
            4: "Gerente",
            5: "Gerente Sênior",
            6: "Diretor",
            7: "Diretor Executivo",
            8: "Vice-Presidente"
        }
        return labels.get(level, "Desconhecido")


class OrganizationalHierarchy(Base):
    """
    Self-referencing table for organizational hierarchy.
    Each collaborator can have a supervisor, forming a tree structure.
    Used for:
    - Case approval by immediate manager
    - Escalation when SLA is breached
    - Future features requiring hierarchy navigation
    """
    __tablename__ = "organizational_hierarchy"

    id = Column(Integer, primary_key=True, index=True)
    collaborator_id = Column(Integer, ForeignKey("collaborators.id"), unique=True, nullable=False)
    supervisor_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    
    # Job information
    job_level = Column(Integer, nullable=False, default=JobLevel.ANALYST)
    job_title = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    cost_center = Column(String(50), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    collaborator = relationship("Collaborator", foreign_keys=[collaborator_id], backref="hierarchy_info")
    supervisor = relationship("Collaborator", foreign_keys=[supervisor_id])
    
    @property
    def job_level_label(self) -> str:
        """Get human-readable job level"""
        return JobLevel.get_label(self.job_level)
    
    def can_escalate(self, max_level: int = JobLevel.DIRECTOR) -> bool:
        """Check if current level allows further escalation"""
        return self.job_level < max_level and self.supervisor_id is not None


class SystemConfiguration(Base):
    """
    System-wide configuration parameters.
    Managed by administrators through the admin panel.
    """
    __tablename__ = "system_configurations"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text, nullable=False)  # JSON string for complex values
    config_type = Column(String(20), default="string")  # string, number, boolean, json
    description = Column(Text, nullable=True)
    category = Column(String(50), default="general")  # approval, escalation, notification, etc.
    
    updated_by = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    updated_by_user = relationship("Collaborator")

    # Default configuration keys
    CONFIG_KEYS = {
        "case_approval_required": {
            "default": "true",
            "type": "boolean",
            "description": "Exigir aprovação do gestor para novos cases",
            "category": "approval"
        },
        "escalation_enabled": {
            "default": "true",
            "type": "boolean",
            "description": "Habilitar escalada automática de pendências",
            "category": "escalation"
        },
        "escalation_sla_hours": {
            "default": "48",
            "type": "number",
            "description": "Horas até escalar pendência para próximo nível",
            "category": "escalation"
        },
        "escalation_max_level": {
            "default": "6",
            "type": "number",
            "description": "Nível máximo de escalada (6=Diretor)",
            "category": "escalation"
        },
        "escalation_reminder_hours": {
            "default": "24",
            "type": "number",
            "description": "Horas para enviar lembrete antes de escalar",
            "category": "escalation"
        },
        "approval_sla_hours": {
            "default": "72",
            "type": "number",
            "description": "Horas para aprovação antes de escalar",
            "category": "approval"
        },
        # ======== Notification Settings ========
        # Email Channel
        "notification_email_enabled": {
            "default": "false",
            "type": "boolean",
            "description": "Habilitar notificações por email",
            "category": "notification"
        },
        "notification_email_smtp_host": {
            "default": "",
            "type": "string",
            "description": "Servidor SMTP para envio de emails",
            "category": "notification"
        },
        "notification_email_smtp_port": {
            "default": "587",
            "type": "number",
            "description": "Porta do servidor SMTP",
            "category": "notification"
        },
        "notification_email_from": {
            "default": "",
            "type": "string",
            "description": "Email de origem para notificações",
            "category": "notification"
        },
        "notification_email_use_tls": {
            "default": "true",
            "type": "boolean",
            "description": "Usar TLS na conexão SMTP",
            "category": "notification"
        },
        # Teams Channel (Power Automate)
        "notification_teams_enabled": {
            "default": "false",
            "type": "boolean",
            "description": "Habilitar notificações via Microsoft Teams",
            "category": "notification"
        },
        "notification_teams_webhook_url": {
            "default": "",
            "type": "string",
            "description": "URL do webhook Power Automate para Teams",
            "category": "notification"
        },
        # System (In-App) Channel
        "notification_system_enabled": {
            "default": "true",
            "type": "boolean",
            "description": "Habilitar notificações no sistema",
            "category": "notification"
        },
        # ======== Event Toggles - Cases ========
        # Each event stores JSON: {"email": true, "teams": true, "system": true}
        "notification_on_case_created": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Case criado",
            "category": "notification_events"
        },
        "notification_on_case_approved": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Case aprovado",
            "category": "notification_events"
        },
        "notification_on_case_rejected": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Case rejeitado",
            "category": "notification_events"
        },
        # ======== Event Toggles - Matching ========
        "notification_on_match_suggested": {
            "default": '{"email": false, "teams": true, "system": true}',
            "type": "json",
            "description": "Sugestão de match encontrada",
            "category": "notification_events"
        },
        "notification_on_owner_review_request": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Solicitação de revisão ao owner",
            "category": "notification_events"
        },
        "notification_on_owner_approved": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Owner aprovou match",
            "category": "notification_events"
        },
        "notification_on_owner_rejected": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Owner rejeitou match",
            "category": "notification_events"
        },
        "notification_on_requester_review_request": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Solicitação de confirmação ao solicitante",
            "category": "notification_events"
        },
        "notification_on_match_confirmed": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Match confirmado",
            "category": "notification_events"
        },
        "notification_on_match_discarded": {
            "default": '{"email": false, "teams": false, "system": true}',
            "type": "json",
            "description": "Match descartado",
            "category": "notification_events"
        },
        "notification_on_owner_validation_request": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Validação de owner necessária",
            "category": "notification_events"
        },
        # ======== Event Toggles - Variables ========
        "notification_on_variable_added": {
            "default": '{"email": false, "teams": true, "system": true}',
            "type": "json",
            "description": "Variável adicionada ao case",
            "category": "notification_events"
        },
        "notification_on_variable_approved": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Variável aprovada",
            "category": "notification_events"
        },
        "notification_on_variable_cancelled": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Variável cancelada",
            "category": "notification_events"
        },
        # ======== Event Toggles - Moderation ========
        "notification_on_moderation_request": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Solicitação de moderação",
            "category": "notification_events"
        },
        "notification_on_moderation_approved": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação aprovada",
            "category": "notification_events"
        },
        "notification_on_moderation_rejected": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação rejeitada",
            "category": "notification_events"
        },
        "notification_on_moderation_cancelled": {
            "default": '{"email": false, "teams": false, "system": true}',
            "type": "json",
            "description": "Moderação cancelada",
            "category": "notification_events"
        },
        "notification_on_moderation_started": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação iniciada",
            "category": "notification_events"
        },
        "notification_on_moderation_expiring": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação próxima de expirar",
            "category": "notification_events"
        },
        "notification_on_moderation_expired": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação expirada",
            "category": "notification_events"
        },
        "notification_on_moderation_revoked": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Moderação revogada",
            "category": "notification_events"
        },
        # ======== Event Toggles - AI Agent ========
        "notification_on_agent_decision_consensus": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Decisão de agente requer consenso",
            "category": "notification_events"
        },
        "notification_on_agent_decision_approved": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Decisão de agente aprovada",
            "category": "notification_events"
        },
        "notification_on_agent_decision_rejected": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Decisão de agente rejeitada",
            "category": "notification_events"
        },
        "notification_on_match_request": {
            "default": '{"email": false, "teams": true, "system": true}',
            "type": "json",
            "description": "Solicitação de match por agente",
            "category": "notification_events"
        },
        # ======== Event Toggles - Involvement ========
        "notification_on_involvement_created": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Envolvimento criado",
            "category": "notification_events"
        },
        "notification_on_involvement_date_set": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Data de entrega definida",
            "category": "notification_events"
        },
        "notification_on_involvement_due_reminder": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Lembrete de prazo",
            "category": "notification_events"
        },
        "notification_on_involvement_overdue": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Prazo vencido",
            "category": "notification_events"
        },
        "notification_on_involvement_completed": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Envolvimento concluído",
            "category": "notification_events"
        },
        # ======== Event Toggles - System ========
        "notification_on_sync_completed": {
            "default": '{"email": false, "teams": true, "system": true}',
            "type": "json",
            "description": "Sincronização de catálogo concluída",
            "category": "notification_events"
        },
        "notification_on_system_alert": {
            "default": '{"email": true, "teams": true, "system": true}',
            "type": "json",
            "description": "Alertas gerais do sistema",
            "category": "notification_events"
        }
    }

    @classmethod
    def get_default_value(cls, key: str) -> str:
        """Get default value for a configuration key"""
        config = cls.CONFIG_KEYS.get(key, {})
        return config.get("default", "")
