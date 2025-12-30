"""
Search Worker Service

Handles asynchronous variable search operations.
This service is designed to be extended for AI agent integration.
"""
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.matching_service import MatchingService


async def trigger_variable_search(db: AsyncSession, variable_id: int) -> None:
    """
    Trigger an asynchronous search for a variable.
    This will be extended to integrate with external AI agents.
    
    Args:
        db: Database session
        variable_id: ID of the variable to search matches for
    """
    try:
        logger.info(f"Auto-triggering search for variable {variable_id}")
        await MatchingService.search_matches(db, variable_id)
        logger.info(f"Search completed for variable {variable_id}")
    except Exception as e:
        logger.error(f"Failed to search variable {variable_id}: {e}")
        # For now, we leave it in SEARCHING status for retry
        # Future: implement retry logic or error status


async def trigger_case_variables_search(db: AsyncSession, case_id: int, variable_ids: list[int]) -> None:
    """
    Trigger asynchronous search for all variables in a case.
    
    Args:
        db: Database session
        case_id: ID of the case
        variable_ids: List of variable IDs to search
    """
    logger.info(f"Auto-triggering search for {len(variable_ids)} variables in case {case_id}")
    
    for variable_id in variable_ids:
        await trigger_variable_search(db, variable_id)
    
    logger.info(f"All variable searches completed for case {case_id}")
