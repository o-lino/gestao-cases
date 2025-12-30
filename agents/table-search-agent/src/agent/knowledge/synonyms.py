"""
Synonym Dictionary

Corporate-specific synonyms for query expansion.
Learnable from user corrections.
"""

import yaml
from pathlib import Path
from typing import Optional


# Default synonyms (embedded, always available)
DEFAULT_SYNONYMS = {
    # Vendas
    "vendas": ["faturamento", "receita", "comercialização", "venda"],
    "faturamento": ["vendas", "receita"],
    "receita": ["vendas", "faturamento"],
    
    # Crédito
    "consignado": ["consig", "empréstimo consignado", "crédito consignado"],
    "consig": ["consignado"],
    "imobiliário": ["imob", "crédito imobiliário", "financiamento imobiliário"],
    "imob": ["imobiliário"],
    
    # Clientes
    "cliente": ["consumidor", "correntista", "titular", "usuário"],
    "consumidor": ["cliente"],
    "correntista": ["cliente"],
    
    # Segmentos
    "varejo": ["retail", "pessoa física", "pf"],
    "pf": ["varejo", "pessoa física"],
    "corporate": ["empresas", "pj", "pessoa jurídica", "corporativo"],
    "pj": ["corporate", "pessoa jurídica", "empresas"],
    
    # Temporais
    "diário": ["diária", "por dia", "daily"],
    "mensal": ["por mês", "monthly", "mês"],
    "anual": ["por ano", "yearly", "ano"],
    
    # Métricas
    "quantidade": ["qtd", "count", "número", "total"],
    "qtd": ["quantidade"],
    "valor": ["montante", "amount", "vlr"],
    "vlr": ["valor"],
    
    # Status
    "ativo": ["ativa", "vigente", "em vigor"],
    "inativo": ["inativa", "cancelado", "encerrado"],
    "inadimplente": ["inadimplência", "default", "atraso"],
}


class SynonymDictionary:
    """
    Manages corporate synonyms for query expansion.
    
    Features:
    - Default embedded synonyms
    - Loadable from YAML file
    - Learnable from user corrections
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self._synonyms: dict[str, set[str]] = {}
        self._learned: dict[str, set[str]] = {}
        self._config_path = config_path
        
        # Load defaults
        self._load_defaults()
        
        # Load from config if provided
        if config_path:
            self._load_from_file(config_path)
    
    def _load_defaults(self):
        """Load default embedded synonyms."""
        for term, syns in DEFAULT_SYNONYMS.items():
            self._synonyms[term.lower()] = set(s.lower() for s in syns)
    
    def _load_from_file(self, path: str):
        """Load synonyms from YAML file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
            
            for term, syns in data.items():
                term_lower = term.lower()
                if term_lower not in self._synonyms:
                    self._synonyms[term_lower] = set()
                self._synonyms[term_lower].update(s.lower() for s in syns)
                
        except FileNotFoundError:
            pass  # Use defaults only
        except Exception as e:
            print(f"Warning: Failed to load synonyms from {path}: {e}")
    
    def get_synonyms(self, term: str) -> list[str]:
        """Get all synonyms for a term."""
        term_lower = term.lower()
        
        synonyms = set()
        
        # From main dictionary
        if term_lower in self._synonyms:
            synonyms.update(self._synonyms[term_lower])
        
        # From learned
        if term_lower in self._learned:
            synonyms.update(self._learned[term_lower])
        
        # Also check if term is a synonym of something else
        for base, syns in self._synonyms.items():
            if term_lower in syns:
                synonyms.add(base)
                synonyms.update(syns)
        
        # Remove the original term
        synonyms.discard(term_lower)
        
        return list(synonyms)
    
    def expand_query(self, query: str, max_expansions: int = 5) -> list[str]:
        """
        Expand query with synonyms.
        
        Returns original query plus expanded versions.
        """
        expansions = [query]
        words = query.lower().split()
        
        for word in words:
            synonyms = self.get_synonyms(word)
            for syn in synonyms[:max_expansions]:
                expanded = query.lower().replace(word, syn)
                if expanded not in expansions:
                    expansions.append(expanded)
                    if len(expansions) >= max_expansions + 1:
                        return expansions
        
        return expansions
    
    def learn(self, original_term: str, synonym: str) -> None:
        """
        Learn a new synonym from user correction.
        
        Called when user corrects a search result.
        """
        original = original_term.lower()
        syn = synonym.lower()
        
        if original not in self._learned:
            self._learned[original] = set()
        
        self._learned[original].add(syn)
        
        # Bidirectional
        if syn not in self._learned:
            self._learned[syn] = set()
        self._learned[syn].add(original)
    
    def save_learned(self, path: str) -> None:
        """Save learned synonyms to file."""
        data = {k: list(v) for k, v in self._learned.items()}
        
        with open(path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
    
    @property
    def stats(self) -> dict:
        """Get dictionary statistics."""
        return {
            "base_terms": len(self._synonyms),
            "learned_terms": len(self._learned),
            "total_synonyms": sum(len(v) for v in self._synonyms.values()),
        }


# Global instance
_synonym_dict: Optional[SynonymDictionary] = None


def get_synonym_dictionary() -> SynonymDictionary:
    """Get or create global synonym dictionary."""
    global _synonym_dict
    if _synonym_dict is None:
        # Try to load from data folder
        config_path = Path(__file__).parent.parent.parent.parent / "data" / "synonyms.yaml"
        _synonym_dict = SynonymDictionary(str(config_path) if config_path.exists() else None)
    return _synonym_dict
