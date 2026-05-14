from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.auth import Token, UserLogin, UserOut, UserCreate, UserUpdate
from app.api.deps import get_current_active_user, require_admin
from typing import List

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Employee ID or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")
    token = create_access_token(data={"sub": user.employee_id})
    user_data = UserOut.model_validate(user).model_dump()
    user_data["roles"] = [ra.role for ra in user.role_assignments] if user.role_assignments else []
    return {"access_token": token, "token_type": "bearer", "user": user_data}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/users")
def list_users(
    skip: int = 0,
    limit: int = 2000,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    users = db.query(User).order_by(User.first_name, User.last_name).offset(skip).limit(limit).all()
    result = []
    for u in users:
        user_dict = UserOut.model_validate(u).model_dump()
        if u.manager:
            user_dict["manager_name"] = f"{u.manager.first_name or ''} {u.manager.last_name or ''}".strip()
        # Include multiple roles
        user_dict["roles"] = [ra.role for ra in u.role_assignments] if u.role_assignments else []
        # Include additional divisions
        user_dict["divisions"] = [da.division_id for da in u.division_assignments] if u.division_assignments else []
        result.append(user_dict)
    return result


@router.post("/users", response_model=UserOut)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if db.query(User).filter(User.employee_id == data.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already registered")
    user = User(
        employee_id=data.employee_id,
        email=data.email or f"{data.employee_id}@emcure.com",
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        role=data.role,
        division_id=data.division_id,
        designation_title=data.designation_title,
        manager_id=data.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}/roles")
def get_user_roles(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserRoleAssignment
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return [ra.role for ra in user.role_assignments]


@router.post("/users/{user_id}/roles")
def assign_user_role(user_id: int, role: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserRoleAssignment
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Check if already assigned
    existing = db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user_id, UserRoleAssignment.role == role).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role already assigned")
    db.add(UserRoleAssignment(user_id=user_id, role=role))
    db.commit()
    return {"ok": True, "roles": [ra.role for ra in db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user_id).all()]}


@router.delete("/users/{user_id}/roles/{role}")
def remove_user_role(user_id: int, role: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserRoleAssignment
    ra = db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == user_id, UserRoleAssignment.role == role).first()
    if not ra:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(ra)
    db.commit()
    return {"ok": True}


# ─── User Division Assignments ────────────────────────────────────────────────

@router.get("/users/{user_id}/divisions")
def get_user_divisions(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserDivisionAssignment
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return [da.division_id for da in user.division_assignments]


@router.post("/users/{user_id}/divisions")
def assign_user_division(user_id: int, division_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserDivisionAssignment
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(UserDivisionAssignment).filter(
        UserDivisionAssignment.user_id == user_id,
        UserDivisionAssignment.division_id == division_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Division already assigned")
    db.add(UserDivisionAssignment(user_id=user_id, division_id=division_id))
    db.commit()
    return {"ok": True, "divisions": [da.division_id for da in db.query(UserDivisionAssignment).filter(UserDivisionAssignment.user_id == user_id).all()]}


@router.delete("/users/{user_id}/divisions/{division_id}")
def remove_user_division(user_id: int, division_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    from app.models.user import UserDivisionAssignment
    da = db.query(UserDivisionAssignment).filter(
        UserDivisionAssignment.user_id == user_id,
        UserDivisionAssignment.division_id == division_id
    ).first()
    if not da:
        raise HTTPException(status_code=404, detail="Division assignment not found")
    db.delete(da)
    db.commit()
    return {"ok": True}
