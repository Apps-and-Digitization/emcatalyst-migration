from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from typing import Optional
from app.db.base import get_db
from app.models.user import Division, CostCenter, Function, Territory, UserGroup
from app.api.deps import get_current_active_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/access", tags=["access-management"])


class DivisionOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class CostCenterOut(BaseModel):
    id: int
    cost_center_id: str
    name: str
    division_id: Optional[int]
    is_active: bool

    class Config:
        from_attributes = True


class FunctionOut(BaseModel):
    id: int
    name: str
    code: Optional[str]

    class Config:
        from_attributes = True


@router.get("/divisions", response_model=List[DivisionOut])
def list_divisions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Division).filter(Division.is_active == True).all()


@router.post("/divisions", response_model=DivisionOut)
def create_division(name: str, code: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    div = Division(name=name, code=code)
    db.add(div)
    db.commit()
    db.refresh(div)
    return div


@router.get("/cost-centers", response_model=List[CostCenterOut])
def list_cost_centers(
    division_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    q = db.query(CostCenter).filter(CostCenter.is_active == True)
    if division_id:
        q = q.filter(CostCenter.division_id == division_id)
    return q.all()


@router.post("/cost-centers", response_model=CostCenterOut)
def create_cost_center(
    cost_center_id: str, name: str,
    division_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    cc = CostCenter(cost_center_id=cost_center_id, name=name, division_id=division_id)
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return cc


@router.get("/functions", response_model=List[FunctionOut])
def list_functions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Function).filter(Function.is_active == True).all()


# ── Hierarchy endpoints ──────────────────────────────────────

@router.get("/hierarchy/my-chain")
def my_manager_chain(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Returns the reporting chain upward from the current user."""
    chain = []
    user = current_user
    visited = set()
    while user:
        if user.id in visited:
            break
        visited.add(user.id)
        chain.append({
            "id": user.id,
            "employee_id": user.employee_id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "designation": user.designation_title,
            "department": user.department,
            "email": user.email,
            "location": user.office_city or user.location,
        })
        user = db.query(User).filter(User.id == user.manager_id).first() if user.manager_id else None
    return chain


@router.get("/hierarchy/team")
def my_team(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Returns direct reports of the current user."""
    reports = db.query(User).filter(User.manager_id == current_user.id, User.is_active == True).all()
    return [
        {
            "id": u.id, "employee_id": u.employee_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "designation": u.designation_title, "department": u.department,
            "email": u.email, "location": u.office_city or u.location,
        }
        for u in reports
    ]


@router.get("/hierarchy/user/{employee_id}")
def get_user_chain(employee_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_active_user)):
    """Returns full upward chain for any employee."""
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(404, "Employee not found")
    chain = []
    visited = set()
    while user:
        if user.id in visited:
            break
        visited.add(user.id)
        chain.append({
            "id": user.id, "employee_id": user.employee_id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "designation": user.designation_title, "department": user.department,
            "email": user.email, "location": user.office_city or user.location,
        })
        user = db.query(User).filter(User.id == user.manager_id).first() if user.manager_id else None
    return chain


@router.get("/hierarchy/tree")
def hierarchy_tree(
    root_employee_id: Optional[str] = None,
    depth: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Returns the org-chart subtree rooted at the given employee (default: top of chain)."""
    if root_employee_id:
        root = db.query(User).filter(User.employee_id == root_employee_id).first()
        if not root:
            raise HTTPException(404, "Employee not found")
    else:
        # Walk to the top of the current user's chain
        root = current_user
        visited = set()
        while root.manager_id and root.id not in visited:
            visited.add(root.id)
            parent = db.query(User).filter(User.id == root.manager_id).first()
            if not parent:
                break
            root = parent

    def build_node(user: User, current_depth: int) -> dict:
        node = {
            "id": user.id, "employee_id": user.employee_id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "designation": user.designation_title or "",
            "department": user.department or "",
            "email": user.email,
            "location": user.office_city or user.location or "",
            "children": []
        }
        if current_depth > 0:
            reports = db.query(User).filter(User.manager_id == user.id, User.is_active == True).all()
            node["children"] = [build_node(r, current_depth - 1) for r in reports]
        return node

    return build_node(root, depth)


@router.get("/hierarchy/search")
def search_employees(
    q: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search employees by name, employee ID or designation."""
    from sqlalchemy import or_
    query = db.query(User).filter(User.is_active == True)
    if q:
        query = query.filter(
            or_(
                User.first_name.ilike(f"%{q}%"),
                User.last_name.ilike(f"%{q}%"),
                User.employee_id.ilike(f"%{q}%"),
                User.designation_title.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )
    users = query.limit(limit).all()
    return [
        {
            "id": u.id, "employee_id": u.employee_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "designation": u.designation_title, "department": u.department,
            "email": u.email, "location": u.office_city or u.location,
            "manager_id": u.manager_id,
            "manager_name": f"{u.manager.first_name or ''} {u.manager.last_name or ''}".strip() if u.manager else None,
            "manager_designation": u.manager.designation_title if u.manager else None,
        }
        for u in users
    ]
