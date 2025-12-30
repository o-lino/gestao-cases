"""
Enhanced AI Service with real LLM integration structure.
Supports multiple providers with fallback mechanism.
"""
import logging
import os
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# Abstract base class for AI providers
class AIProvider(ABC):
    @abstractmethod
    async def summarize(self, text: str, max_length: int = 200) -> str:
        pass
    
    @abstractmethod
    async def classify(self, text: str, categories: list[str]) -> Dict[str, float]:
        pass
    
    @abstractmethod
    async def analyze_risk(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    async def suggest_tags(self, text: str, max_tags: int = 5) -> list[str]:
        pass

# Mock provider for development
class MockAIProvider(AIProvider):
    """Mock AI provider for development and testing."""
    
    async def summarize(self, text: str, max_length: int = 200) -> str:
        if not text:
            return "Sem conteúdo para resumir."
        
        words = text.split()
        if len(words) <= 30:
            return text
        
        return " ".join(words[:30]) + "..."
    
    async def classify(self, text: str, categories: list[str]) -> Dict[str, float]:
        import random
        scores = {cat: random.uniform(0.1, 0.9) for cat in categories}
        total = sum(scores.values())
        return {cat: score/total for cat, score in scores.items()}
    
    async def analyze_risk(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        # Analyze risk based on case complexity (number of variables, context length, etc.)
        context_length = len(case_data.get("context") or "")
        impact_length = len(case_data.get("impact") or "")
        
        if context_length > 1000 or impact_length > 500:
            risk_level = "CRITICAL"
            score = 95
        elif context_length > 500 or impact_length > 250:
            risk_level = "HIGH"
            score = 75
        elif context_length > 200 or impact_length > 100:
            risk_level = "MEDIUM"
            score = 50
        else:
            risk_level = "LOW"
            score = 25
        
        return {
            "risk_level": risk_level,
            "score": score,
            "factors": [
                {"name": "Complexity", "impact": "high" if context_length > 500 else "low"},
                {"name": "Impact Scope", "impact": "medium"},
                {"name": "Timeline", "impact": "low"},
            ],
            "recommendations": [
                "Revisar escopo do projeto" if context_length > 500 else "Manter acompanhamento regular",
                "Definir marcos de entrega claros",
            ]
        }
    
    async def suggest_tags(self, text: str, max_tags: int = 5) -> list[str]:
        # Simple keyword extraction
        common_tags = ["urgente", "estratégico", "operacional", "cliente-chave", "inovação"]
        text_lower = text.lower()
        
        suggested = []
        if "urgente" in text_lower or "imediato" in text_lower:
            suggested.append("urgente")
        if "estratég" in text_lower:
            suggested.append("estratégico")
        if "cliente" in text_lower:
            suggested.append("cliente-chave")
        
        # Fill with common tags
        while len(suggested) < max_tags:
            for tag in common_tags:
                if tag not in suggested:
                    suggested.append(tag)
                    break
            else:
                break
        
        return suggested[:max_tags]

# OpenAI provider (structure for future implementation)
class OpenAIProvider(AIProvider):
    """OpenAI API provider - implement when API key is available."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OpenAI API key not configured")
    
    async def summarize(self, text: str, max_length: int = 200) -> str:
        if not self.api_key:
            raise NotImplementedError("OpenAI API key not configured")
        
        # TODO: Implement OpenAI API call
        # import openai
        # response = await openai.ChatCompletion.acreate(...)
        raise NotImplementedError("OpenAI integration pending")
    
    async def classify(self, text: str, categories: list[str]) -> Dict[str, float]:
        raise NotImplementedError("OpenAI integration pending")
    
    async def analyze_risk(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("OpenAI integration pending")
    
    async def suggest_tags(self, text: str, max_tags: int = 5) -> list[str]:
        raise NotImplementedError("OpenAI integration pending")

# Main AI Service class
class EnhancedAIService:
    """
    Enhanced AI Service with multiple providers and fallback.
    """
    
    def __init__(self):
        self.providers: list[AIProvider] = []
        self._setup_providers()
    
    def _setup_providers(self):
        """Set up AI providers with fallback chain."""
        # Try OpenAI first if configured
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                self.providers.append(OpenAIProvider(openai_key))
                logger.info("OpenAI provider configured")
            except Exception as e:
                logger.warning(f"Failed to configure OpenAI: {e}")
        
        # Always add mock as fallback
        self.providers.append(MockAIProvider())
        logger.info("Mock AI provider configured as fallback")
    
    async def _call_with_fallback(self, method: str, *args, **kwargs) -> Any:
        """Call method on providers with fallback."""
        last_error = None
        
        for provider in self.providers:
            try:
                func = getattr(provider, method)
                result = await func(*args, **kwargs)
                return result
            except NotImplementedError:
                continue
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {provider.__class__.__name__} failed: {e}")
                continue
        
        if last_error:
            raise last_error
        raise RuntimeError("No AI provider available")
    
    async def summarize_case(self, case_data: Dict[str, Any]) -> str:
        """Summarize a case."""
        text = f"""
        Título: {case_data.get('title', '')}
        Contexto: {case_data.get('context', '')}
        Impacto: {case_data.get('impact', '')}
        Necessidade: {case_data.get('necessity', '')}
        """
        return await self._call_with_fallback("summarize", text)
    
    async def classify_case(self, case_data: Dict[str, Any]) -> Dict[str, float]:
        """Classify a case into categories."""
        categories = ["Operacional", "Estratégico", "Tático", "Emergencial"]
        text = case_data.get("context", "") + " " + case_data.get("impact", "")
        return await self._call_with_fallback("classify", text, categories)
    
    async def assess_risk(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risk for a case."""
        return await self._call_with_fallback("analyze_risk", case_data)
    
    async def suggest_tags(self, case_data: Dict[str, Any]) -> list[str]:
        """Suggest tags for a case."""
        text = f"{case_data.get('title', '')} {case_data.get('context', '')} {case_data.get('impact', '')}"
        return await self._call_with_fallback("suggest_tags", text)
    
    async def generate_insights(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive AI insights for a case."""
        summary = await self.summarize_case(case_data)
        classification = await self.classify_case(case_data)
        risk = await self.assess_risk(case_data)
        tags = await self.suggest_tags(case_data)
        
        return {
            "summary": summary,
            "classification": classification,
            "risk": risk,
            "suggested_tags": tags,
            "generated_at": "now",
        }

# Singleton instance
enhanced_ai_service = EnhancedAIService()
