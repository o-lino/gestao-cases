"""
Analytics endpoints for dashboard and reporting.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import Optional

from app.db.session import get_db
from app.models.case import Case
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get dashboard statistics for a given period.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Base query for period
    base_query = select(Case).where(Case.created_at >= cutoff_date)
    
    # Total cases
    total_result = await db.execute(
        select(func.count(Case.id)).where(Case.created_at >= cutoff_date)
    )
    total_count = total_result.scalar() or 0
    
    # Cases by status
    status_query = select(
        Case.status,
        func.count(Case.id).label('count')
    ).where(Case.created_at >= cutoff_date).group_by(Case.status)
    
    status_result = await db.execute(status_query)
    status_counts = {row.status: row.count for row in status_result.all()}
    
    # Active cases (not CLOSED or REJECTED)
    active_count = sum(
        count for status, count in status_counts.items() 
        if status not in ['CLOSED', 'REJECTED']
    )
    
    # Average budget
    budget_result = await db.execute(
        select(func.avg(Case.budget)).where(
            and_(Case.created_at >= cutoff_date, Case.budget.isnot(None))
        )
    )
    avg_budget = float(budget_result.scalar() or 0)
    
    # Approval rate
    closed_statuses = ['APPROVED', 'REJECTED', 'CLOSED']
    closed_count = sum(status_counts.get(s, 0) for s in closed_statuses)
    approved_count = status_counts.get('APPROVED', 0)
    approval_rate = (approved_count / closed_count * 100) if closed_count > 0 else 0
    
    # Recent activity (last 7 days)
    recent_date = datetime.utcnow() - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count(Case.id)).where(Case.created_at >= recent_date)
    )
    recent_count = recent_result.scalar() or 0
    
    return {
        "period_days": days,
        "total_cases": total_count,
        "active_cases": active_count,
        "recent_activity": recent_count,
        "avg_budget": round(avg_budget, 2),
        "approval_rate": round(approval_rate, 1),
        "status_distribution": status_counts,
    }


@router.get("/dashboard/trends")
async def get_dashboard_trends(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get case creation trends over time.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Group by date
    query = select(
        func.date(Case.created_at).label('date'),
        func.count(Case.id).label('total'),
        func.sum(
            func.case(
                (Case.status == 'APPROVED', 1),
                else_=0
            )
        ).label('approved')
    ).where(
        Case.created_at >= cutoff_date
    ).group_by(
        func.date(Case.created_at)
    ).order_by(
        func.date(Case.created_at)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    trends = [
        {
            "date": row.date.isoformat() if row.date else None,
            "total": row.total,
            "approved": row.approved or 0,
        }
        for row in rows
    ]
    
    return {"trends": trends}


@router.get("/dashboard/top-clients")
async def get_top_clients(
    limit: int = Query(5, ge=1, le=20),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get top clients by case count.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = select(
        Case.client_name,
        func.count(Case.id).label('case_count'),
        func.sum(Case.budget).label('total_budget')
    ).where(
        and_(
            Case.created_at >= cutoff_date,
            Case.client_name.isnot(None)
        )
    ).group_by(
        Case.client_name
    ).order_by(
        func.count(Case.id).desc()
    ).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    clients = [
        {
            "name": row.client_name,
            "case_count": row.case_count,
            "total_budget": float(row.total_budget or 0),
        }
        for row in rows
    ]
    
    return {"clients": clients}
