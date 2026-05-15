from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.base import get_db
from app.api.deps import get_current_active_user, require_admin
from app.models.user import User
from app.models.rbac import Role, Page, RolePageAccess
from app.services.rbac_service import get_user_accessible_pages

router = APIRouter(prefix="/rbac", tags=["RBAC"])


# --- Schemas ---

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AccessEntry(BaseModel):
    role_id: int
    page_id: int
    can_access: bool


class AccessMatrixUpdate(BaseModel):
    entries: list[AccessEntry]


# --- Role Endpoints ---

@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    roles = db.query(Role).order_by(Role.name).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "is_active": r.is_active,
            "created_at": r.created_at,
        }
        for r in roles
    ]


@router.get("/roles/list")
def list_roles_public(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    """Public list of active role names — accessible to any authenticated user."""
    roles = db.query(Role).filter(Role.is_active == True).order_by(Role.name).all()
    return [{"id": r.id, "name": r.name} for r in roles]


@router.post("/roles", status_code=201)
def create_role(data: RoleCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    role = Role(name=data.name, description=data.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"id": role.id, "name": role.name, "description": role.description}


@router.put("/roles/{role_id}")
def update_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if data.name is not None:
        role.name = data.name
    if data.description is not None:
        role.description = data.description
    if data.is_active is not None:
        # Prevent deactivating Administrator
        if role.name == "Administrator" and not data.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate Administrator role")
        role.is_active = data.is_active
    db.commit()
    return {"id": role.id, "name": role.name, "description": role.description, "is_active": role.is_active}


@router.delete("/roles/{role_id}")
def deactivate_role(role_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.name == "Administrator":
        raise HTTPException(status_code=400, detail="Cannot deactivate Administrator role")
    role.is_active = False
    db.commit()
    return {"message": f"Role '{role.name}' deactivated"}


@router.put("/roles/{role_id}/reactivate")
def reactivate_role(role_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.is_active = True
    db.commit()
    return {"message": f"Role '{role.name}' reactivated"}


# --- Pages Endpoint ---

@router.get("/pages")
def list_pages(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    pages = db.query(Page).order_by(Page.nav_group, Page.page_label).all()
    return [
        {
            "id": p.id,
            "page_key": p.page_key,
            "page_label": p.page_label,
            "page_path": p.page_path,
            "nav_group": p.nav_group,
            "is_active": p.is_active,
        }
        for p in pages
    ]


# --- Access Matrix Endpoints ---

@router.get("/access")
def get_access_matrix(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Get full role-page access matrix."""
    entries = (
        db.query(RolePageAccess)
        .join(Role)
        .join(Page)
        .filter(Role.is_active == True, Page.is_active == True)
        .all()
    )
    return [
        {
            "id": e.id,
            "role_id": e.role_id,
            "page_id": e.page_id,
            "can_access": e.can_access,
            "role_name": e.role.name,
            "page_key": e.page.page_key,
        }
        for e in entries
    ]


@router.put("/access")
def update_access_matrix(data: AccessMatrixUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Bulk update access matrix for a role."""
    for entry in data.entries:
        existing = (
            db.query(RolePageAccess)
            .filter(RolePageAccess.role_id == entry.role_id, RolePageAccess.page_id == entry.page_id)
            .first()
        )
        if existing:
            existing.can_access = entry.can_access
        else:
            db.add(RolePageAccess(role_id=entry.role_id, page_id=entry.page_id, can_access=entry.can_access))
    db.commit()

    # Ensure Administrator always has full access
    admin_role = db.query(Role).filter(Role.name == "Administrator").first()
    if admin_role:
        admin_entries = (
            db.query(RolePageAccess)
            .filter(RolePageAccess.role_id == admin_role.id)
            .all()
        )
        for ae in admin_entries:
            ae.can_access = True
        db.commit()

    return {"message": "Access matrix updated"}


@router.get("/access/me")
def get_my_access(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Return list of accessible page keys for the logged-in user."""
    page_keys = get_user_accessible_pages(db, current_user)
    return {"pages": page_keys}
