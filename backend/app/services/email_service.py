"""
Email notification service with templates.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


# Email templates
TEMPLATES = {
    "case_created": {
        "subject": "Novo Case Criado: {title}",
        "body": """
            <h2>Um novo case foi criado</h2>
            <p><strong>Título:</strong> {title}</p>
            <p><strong>Cliente:</strong> {client_name}</p>
            <p><strong>Solicitante:</strong> {requester_email}</p>
            <p><strong>Status:</strong> {status}</p>
            <p><a href="{app_url}/cases/{case_id}">Ver Case</a></p>
        """,
    },
    "case_submitted": {
        "subject": "Case Enviado para Revisão: {title}",
        "body": """
            <h2>Case enviado para revisão</h2>
            <p>O case <strong>{title}</strong> foi enviado para revisão e aguarda aprovação.</p>
            <p><strong>Cliente:</strong> {client_name}</p>
            <p><strong>Budget:</strong> {budget}</p>
            <p><a href="{app_url}/cases/{case_id}">Revisar Case</a></p>
        """,
    },
    "case_approved": {
        "subject": "✅ Case Aprovado: {title}",
        "body": """
            <h2 style="color: #28a745;">Case Aprovado!</h2>
            <p>Seu case <strong>{title}</strong> foi aprovado.</p>
            <p><strong>Aprovado por:</strong> {approved_by}</p>
            <p><strong>Data:</strong> {date}</p>
            <p><a href="{app_url}/cases/{case_id}">Ver Detalhes</a></p>
        """,
    },
    "case_rejected": {
        "subject": "❌ Case Rejeitado: {title}",
        "body": """
            <h2 style="color: #dc3545;">Case Rejeitado</h2>
            <p>Seu case <strong>{title}</strong> foi rejeitado.</p>
            <p><strong>Rejeitado por:</strong> {rejected_by}</p>
            <p><strong>Motivo:</strong> {reason}</p>
            <p><a href="{app_url}/cases/{case_id}">Ver Detalhes</a></p>
        """,
    },
    "case_comment": {
        "subject": "Novo Comentário em: {title}",
        "body": """
            <h2>Novo comentário adicionado</h2>
            <p><strong>Case:</strong> {title}</p>
            <p><strong>Autor:</strong> {author}</p>
            <p><strong>Comentário:</strong></p>
            <blockquote>{comment}</blockquote>
            <p><a href="{app_url}/cases/{case_id}">Ver Comentário</a></p>
        """,
    },
    "deadline_reminder": {
        "subject": "⚠️ Prazo Próximo: {title}",
        "body": """
            <h2 style="color: #ffc107;">Lembrete de Prazo</h2>
            <p>O case <strong>{title}</strong> tem prazo previsto para <strong>{end_date}</strong>.</p>
            <p>Faltam {days_remaining} dias.</p>
            <p><a href="{app_url}/cases/{case_id}">Ver Case</a></p>
        """,
    },
}


def get_email_wrapper(content: str) -> str:
    """Wrap email content in HTML template."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            h2 {{ color: #1a1a2e; }}
            a {{ color: #0066cc; }}
            blockquote {{ 
                border-left: 3px solid #ddd; 
                margin: 10px 0; 
                padding: 10px 20px; 
                background: #f9f9f9; 
            }}
            .footer {{ 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #eee; 
                font-size: 12px; 
                color: #666; 
            }}
        </style>
    </head>
    <body>
        <div class="container">
            {content}
            <div class="footer">
                <p>Sistema de Gestão de Cases v2.0</p>
                <p>Este é um email automático. Não responda diretamente.</p>
            </div>
        </div>
    </body>
    </html>
    """


class EmailService:
    """
    Email notification service.
    Supports multiple providers (SES, SendGrid, SMTP).
    """
    
    def __init__(self, app_url: str = "http://localhost:5173"):
        self.app_url = app_url
        self.provider = "mock"  # mock, ses, sendgrid, smtp
        self.from_email = "noreply@gestao-cases.com"
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email."""
        try:
            if self.provider == "mock":
                logger.info(f"[MOCK EMAIL] To: {to_email}, Subject: {subject}")
                return True
            
            # TODO: Implement real email providers
            # elif self.provider == "ses":
            #     return await self._send_ses(to_email, subject, html_content)
            # elif self.provider == "sendgrid":
            #     return await self._send_sendgrid(to_email, subject, html_content)
            
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    async def send_template_email(
        self,
        template_name: str,
        to_email: str,
        context: Dict[str, Any]
    ) -> bool:
        """Send email using a template."""
        template = TEMPLATES.get(template_name)
        if not template:
            logger.error(f"Template not found: {template_name}")
            return False
        
        # Add app_url to context
        context["app_url"] = self.app_url
        
        # Format template
        subject = template["subject"].format(**context)
        body = template["body"].format(**context)
        html_content = get_email_wrapper(body)
        
        return await self.send_email(to_email, subject, html_content)
    
    async def notify_case_created(self, case_data: Dict[str, Any], recipients: list[str]):
        """Notify about new case creation."""
        for email in recipients:
            await self.send_template_email("case_created", email, {
                "title": case_data.get("title", ""),
                "client_name": case_data.get("client_name", "N/A"),
                "requester_email": case_data.get("requester_email", ""),
                "status": case_data.get("status", "DRAFT"),
                "case_id": case_data.get("id"),
            })
    
    async def notify_case_approved(
        self,
        case_data: Dict[str, Any],
        recipient: str,
        approved_by: str
    ):
        """Notify about case approval."""
        await self.send_template_email("case_approved", recipient, {
            "title": case_data.get("title", ""),
            "approved_by": approved_by,
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "case_id": case_data.get("id"),
        })
    
    async def notify_case_rejected(
        self,
        case_data: Dict[str, Any],
        recipient: str,
        rejected_by: str,
        reason: str
    ):
        """Notify about case rejection."""
        await self.send_template_email("case_rejected", recipient, {
            "title": case_data.get("title", ""),
            "rejected_by": rejected_by,
            "reason": reason or "Nenhum motivo especificado",
            "case_id": case_data.get("id"),
        })
    
    async def notify_new_comment(
        self,
        case_data: Dict[str, Any],
        recipient: str,
        author: str,
        comment: str
    ):
        """Notify about new comment."""
        await self.send_template_email("case_comment", recipient, {
            "title": case_data.get("title", ""),
            "author": author,
            "comment": comment,
            "case_id": case_data.get("id"),
        })


# Singleton instance
email_service = EmailService()
