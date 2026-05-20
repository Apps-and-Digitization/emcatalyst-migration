from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from typing import Optional
from app.db.base import get_db
from app.models.user import Division, Territory, UserGroup
from app.api.deps import get_current_active_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/access", tags=["access-management"])


class DivisionOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    costcenter: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/divisions", response_model=List[DivisionOut])
def list_divisions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Division).filter(Division.is_active == True).all()


@router.get("/divisions/my")
def list_my_divisions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Return only divisions the current user has access to (primary + additional)."""
    if current_user.is_superuser or current_user.role == "Administrator":
        divs = db.query(Division).filter(Division.is_active == True).all()
        return [{"id": d.id, "name": d.name, "code": d.code, "costcenter": d.costcenter} for d in divs]

    div_ids = set()
    if current_user.division_id:
        div_ids.add(current_user.division_id)
    if current_user.division_assignments:
        for da in current_user.division_assignments:
            div_ids.add(da.division_id)

    if not div_ids:
        return []

    divs = db.query(Division).filter(Division.id.in_(div_ids), Division.is_active == True).all()
    return [{"id": d.id, "name": d.name, "code": d.code, "costcenter": d.costcenter} for d in divs]


@router.post("/divisions", response_model=DivisionOut)
def create_division(name: str, code: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    div = Division(name=name, code=code)
    db.add(div)
    db.commit()
    db.refresh(div)
    return div


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


@router.get("/hierarchy/full")
def my_full_hierarchy(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Returns all users in the current user's hierarchy — managers above and all subordinates below."""
    result = []
    seen_ids = set()

    def add_user(u, relation):
        if u.id in seen_ids:
            return
        seen_ids.add(u.id)
        result.append({
            "id": u.id, "employee_id": u.employee_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "designation": u.designation_title,
            "department": u.department,
            "email": u.email,
            "relation": relation,
        })

    # Add current user
    add_user(current_user, "self")

    # Walk up the chain (managers)
    user = current_user
    while user.manager_id:
        mgr = db.query(User).filter(User.id == user.manager_id, User.is_active == True).first()
        if not mgr or mgr.id in seen_ids:
            break
        add_user(mgr, "manager")
        user = mgr

    # Walk down (all subordinates recursively)
    def get_subordinates(manager_id):
        subs = db.query(User).filter(User.manager_id == manager_id, User.is_active == True).all()
        for s in subs:
            if s.id not in seen_ids:
                add_user(s, "subordinate")
                get_subordinates(s.id)

    get_subordinates(current_user.id)

    return result


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


@router.get("/hierarchy/subordinates-by-role")
def get_subordinates_by_role(
    role: str = "Territory Manager",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all subordinates (recursive) of the current user who have the specified role.
    Traverses the full hierarchy tree downward from the current user.
    Only returns users who have the given role in their role_assignments.
    """
    from app.models.user import UserRoleAssignment

    # Collect all subordinate user IDs recursively
    def get_all_subordinate_ids(user_id: int, visited: set) -> set:
        if user_id in visited:
            return set()
        visited.add(user_id)
        direct_reports = db.query(User).filter(User.manager_id == user_id, User.is_active == True).all()
        ids = set()
        for report in direct_reports:
            ids.add(report.id)
            ids.update(get_all_subordinate_ids(report.id, visited))
        return ids

    subordinate_ids = get_all_subordinate_ids(current_user.id, set())

    if not subordinate_ids:
        return []

    # Filter subordinates who have the specified role (check both role_assignments table and user.role column)
    from sqlalchemy import or_
    users_with_role = (
        db.query(User)
        .outerjoin(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
        .filter(
            User.id.in_(subordinate_ids),
            or_(
                UserRoleAssignment.role == role,
                User.role == role,
            ),
            User.is_active == True,
        )
        .distinct()
        .all()
    )

    return [
        {
            "id": u.id,
            "employee_id": u.employee_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "designation": u.designation_title,
            "email": u.email,
            "territory_name": u.territory_name,
            "location": u.office_city or u.location,
        }
        for u in users_with_role
    ]


@router.get("/hierarchy/all-subordinates")
def get_all_subordinates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all subordinates (recursive) of the current user regardless of role.
    Traverses the full hierarchy tree downward from the current user.
    """
    def get_all_subordinate_ids(user_id: int, visited: set) -> set:
        if user_id in visited:
            return set()
        visited.add(user_id)
        direct_reports = db.query(User).filter(User.manager_id == user_id, User.is_active == True).all()
        ids = set()
        for report in direct_reports:
            ids.add(report.id)
            ids.update(get_all_subordinate_ids(report.id, visited))
        return ids

    subordinate_ids = get_all_subordinate_ids(current_user.id, set())

    if not subordinate_ids:
        return []

    users = db.query(User).filter(User.id.in_(subordinate_ids), User.is_active == True).order_by(User.first_name).all()

    return [
        {
            "id": u.id,
            "employee_id": u.employee_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
            "designation": u.designation_title,
            "email": u.email,
            "role": u.role,
            "territory_id": u.territory_id,
            "territory_name": getattr(u, 'territory_name', None),
            "location": u.office_city or getattr(u, 'location', None),
        }
        for u in users
    ]
