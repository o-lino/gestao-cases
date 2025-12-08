
from typing import Any
from datetime import datetime
from fastapi import HTTPException, status

def validate_variable_value(var_type: str, value: Any) -> bool:
    """
    Valida se o valor corresponde ao tipo declarado.
    
    Args:
        var_type: Tipo esperado (text, number, date, boolean, select)
        value: Valor a ser validado
        
    Returns:
        bool: True se válido, False caso contrário
    """
    if value is None:
        return True  # Valores opcionais são válidos
    
    try:
        if var_type == 'number':
            float(value)
        elif var_type == 'date':
            if isinstance(value, str):
                # Aceita formatos ISO 8601
                datetime.fromisoformat(value.replace('Z', '+00:00'))
        elif var_type == 'boolean':
            if isinstance(value, str):
                if value.lower() not in ['true', 'false', '1', '0', 'yes', 'no']:
                    raise ValueError
        # text e select aceitam qualquer string
        return True
    except (ValueError, TypeError):
        return False

def validate_case_variables(variables: list) -> None:
    """
    Valida uma lista de variáveis antes de persistência.
    
    Args:
        variables: Lista de objetos CaseVariableSchema
        
    Raises:
        HTTPException: Se alguma variável for inválida
    """
    for var in variables:
        if not validate_variable_value(var.variable_type, var.variable_value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid format for variable '{var.variable_name}' of type '{var.variable_type}'"
            )
        
        # Validação de campos obrigatórios
        if var.is_required and (var.variable_value is None or var.variable_value == ''):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Variable '{var.variable_name}' is required but has no value"
            )
