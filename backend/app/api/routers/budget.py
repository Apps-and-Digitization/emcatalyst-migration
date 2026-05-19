from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db.base import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.budget import MasterBudget, BudgetAuditTrail, BrsBudget, BrsBudgetAuditTrail

router = APIRouter(prefix="/budget", tags=["budget"])


# ─── Event Budget ──────────────────────────────────────────────────────────────

@router.get("/events")
def list_event_budgets(
    division_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    q = db.query(MasterBudget).filter(MasterBudget.is_active == True)
    if division_id:
        q = q.filter(MasterBudget.division_id == division_id)
    budgets = q.order_by(MasterBudget.budget_month.desc()).all()
    return [{
        "id": b.id, "division_id": b.division_id,
        "division_name": b.division.name if b.division else None,
        "budget_type": b.budget_type,
        "budget_month": b.budget_month.strftime("%Y-%m") if b.budget_month else None,
        "allocated_budget": float(b.allocated_budget),
        "utilized_budget": float(b.utilized_budget or 0),
        "remaining_budget": float(b.allocated_budget) - float(b.utilized_budget or 0),
        "is_active": b.is_active,
    } for b in budgets]


@router.get("/events/{budget_id}/audit-trail")
def get_event_budget_audit_trail(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    trails = db.query(BudgetAuditTrail).filter(BudgetAuditTrail.budget_id == budget_id).order_by(BudgetAuditTrail.created_at.desc()).all()
    return [{
        "id": t.id, "action": t.action, "amount": float(t.amount) if t.amount else None,
        "description": t.description, "event_code": t.event_code,
        "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else "System",
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in trails]


@router.post("/events")
def create_event_budget(
    division_id: int,
    budget_type: str,
    budget_month: str,
    allocated_budget: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime as dt
    parsed_month = dt.strptime(budget_month + "-01", "%Y-%m-%d")
    b = MasterBudget(
        division_id=division_id, budget_type=budget_type,
        budget_month=parsed_month, allocated_budget=allocated_budget
    )
    db.add(b)
    db.flush()
    db.add(BudgetAuditTrail(
        budget_id=b.id, action="Created", amount=b.allocated_budget,
        description=f"Budget created with \u20b9{float(b.allocated_budget):,.0f} allocation",
        performed_by_id=current_user.id
    ))
    db.commit()
    db.refresh(b)
    return {"id": b.id}


@router.put("/events/{budget_id}")
def update_event_budget(
    budget_id: int,
    division_id: Optional[int] = None,
    budget_type: Optional[str] = None,
    budget_month: Optional[str] = None,
    allocated_budget: Optional[float] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    b = db.query(MasterBudget).filter(MasterBudget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    old_allocated = float(b.allocated_budget) if b.allocated_budget else 0
    if division_id is not None:
        b.division_id = division_id
    if budget_type is not None:
        b.budget_type = budget_type
    if budget_month is not None:
        from datetime import datetime as dt
        b.budget_month = dt.strptime(budget_month + "-01", "%Y-%m-%d")
    if allocated_budget is not None:
        b.allocated_budget = allocated_budget
    if is_active is not None:
        b.is_active = is_active
    if allocated_budget is not None and allocated_budget != old_allocated:
        diff = allocated_budget - old_allocated
        direction = "increased" if diff > 0 else "decreased"
        db.add(BudgetAuditTrail(
            budget_id=b.id, action="Updated", amount=abs(diff),
            description=f"Allocated budget {direction} from \u20b9{old_allocated:,.0f} to \u20b9{allocated_budget:,.0f}",
            performed_by_id=current_user.id
        ))
    db.commit()
    return {"ok": True}


@router.delete("/events/{budget_id}")
def delete_event_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "Administrator" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only admin can delete budgets")
    b = db.query(MasterBudget).filter(MasterBudget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(b)
    db.commit()
    return {"ok": True}


# ─── BRS Budget (Quarter-wise) ─────────────────────────────────────────────────

@router.get("/brs")
def list_brs_budgets(
    division_id: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    q = db.query(BrsBudget).filter(BrsBudget.is_active == True)
    if division_id:
        q = q.filter(BrsBudget.division_id == division_id)
    if year:
        q = q.filter(BrsBudget.year == year)
    budgets = q.order_by(BrsBudget.year.desc(), BrsBudget.quarter).all()
    return [
        {
            "id": b.id,
            "division_id": b.division_id,
            "division_name": b.division.name if b.division else None,
            "quarter": b.quarter,
            "year": b.year,
            "allocated_budget": float(b.allocated_budget),
            "utilized_budget": float(b.utilized_budget or 0),
            "available_budget": float(b.allocated_budget) - float(b.utilized_budget or 0),
            "is_active": b.is_active,
        }
        for b in budgets
    ]


@router.get("/brs/{budget_id}/audit-trail")
def get_brs_budget_audit_trail(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    trails = db.query(BrsBudgetAuditTrail).filter(
        BrsBudgetAuditTrail.budget_id == budget_id
    ).order_by(BrsBudgetAuditTrail.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "action": t.action,
            "amount": float(t.amount) if t.amount else None,
            "description": t.description,
            "brs_code": t.brs_code,
            "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else "System",
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trails
    ]


@router.post("/brs")
def create_brs_budget(
    division_id: int,
    quarter: int,
    year: int,
    allocated_budget: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if quarter not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="Quarter must be 1, 2, 3, or 4")
    existing = db.query(BrsBudget).filter(
        BrsBudget.division_id == division_id,
        BrsBudget.quarter == quarter,
        BrsBudget.year == year,
        BrsBudget.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Budget already exists for this division, Q{quarter} {year}")
    b = BrsBudget(
        division_id=division_id, quarter=quarter, year=year,
        allocated_budget=allocated_budget, utilized_budget=0,
    )
    db.add(b)
    db.flush()
    db.add(BrsBudgetAuditTrail(
        budget_id=b.id, action="Created", amount=allocated_budget,
        description=f"Budget created: \u20b9{allocated_budget:,.0f} for Q{quarter} {year}",
        performed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(b)
    return {"id": b.id, "division_id": b.division_id, "quarter": b.quarter, "year": b.year, "allocated_budget": float(b.allocated_budget)}


@router.put("/brs/{budget_id}")
def update_brs_budget(
    budget_id: int,
    allocated_budget: Optional[float] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    b = db.query(BrsBudget).filter(BrsBudget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    if allocated_budget is not None:
        old = float(b.allocated_budget)
        b.allocated_budget = allocated_budget
        db.add(BrsBudgetAuditTrail(
            budget_id=b.id, action="Updated", amount=allocated_budget - old,
            description=f"Budget updated from \u20b9{old:,.0f} to \u20b9{allocated_budget:,.0f}",
            performed_by_id=current_user.id,
        ))
    if is_active is not None:
        b.is_active = is_active
    db.commit()
    return {"ok": True}


@router.delete("/brs/{budget_id}")
def delete_brs_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "Administrator" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only admin can delete budgets")
    b = db.query(BrsBudget).filter(BrsBudget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(b)
    db.commit()
    return {"ok": True}
