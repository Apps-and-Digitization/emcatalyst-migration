from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
import httpx
import urllib.parse
from app.db.base import get_db
from app.core.security import verify_password, create_access_token, get_password_hash, decode_token
from app.core.email import send_email
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import Token, UserLogin, UserOut, UserCreate, UserUpdate
from app.api.deps import get_current_active_user, require_admin
from typing import List
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    data: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Admin can reset any user's password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": f"Password reset for {user.first_name} {user.last_name}"}


class ForgotPasswordRequest(BaseModel):
    employee_id: str


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Send a password reset link to the user's email."""
    user = db.query(User).filter(User.employee_id == data.employee_id).first()
    # Always return success to prevent user enumeration
    if not user or not user.email:
        return {"message": "If an account with that Employee ID exists, a reset link has been sent to the registered email."}

    # Create a short-lived token (30 minutes)
    reset_token = create_access_token(
        data={"sub": user.employee_id, "purpose": "password_reset"},
        expires_delta=timedelta(minutes=30)
    )
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    # Send email in background
    subject = "Password Reset — EMCatalyst"
    body_html = f"""
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:500px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:28px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:12px;">Emcure Pharmaceuticals</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:15px;margin:0 0 16px;">Hi <strong>{user.first_name or 'User'}</strong>,</p>
    <p style="font-size:14px;color:#6c757d;line-height:1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{reset_link}" style="background:#ed1c24;color:#fff;padding:14px 32px;border-radius:9999px;
         text-decoration:none;font-size:14px;font-weight:600;display:inline-block;box-shadow:0 4px 16px rgba(237,28,36,.25);">Reset Password</a>
    </div>
    <p style="font-size:12px;color:#adb5bd;margin:0 0 8px;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
    <p style="font-size:11px;color:#ced4da;word-break:break-all;">Link: {reset_link}</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd. | This email is auto-generated.
  </div>
</div>
</body></html>
"""
    body_text = f"Hi {user.first_name or 'User'},\n\nReset your password: {reset_link}\n\nThis link expires in 30 minutes."
    background_tasks.add_task(send_email, user.email, subject, body_html, body_text)

    return {"message": "If an account with that Employee ID exists, a reset link has been sent to the registered email."}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using the token from the email link."""
    payload = decode_token(data.token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    employee_id = payload.get("sub")
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password has been reset successfully. You can now login with your new password."}


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


# ─── Microsoft SSO (Azure AD) ─────────────────────────────────────────────────

AZURE_AUTHORITY = f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}"
AZURE_TOKEN_URL = f"{AZURE_AUTHORITY}/oauth2/v2.0/token"
AZURE_AUTHORIZE_URL = f"{AZURE_AUTHORITY}/oauth2/v2.0/authorize"


@router.get("/microsoft/login")
def microsoft_login():
    """Return the Microsoft OAuth2 authorization URL for the frontend to redirect to."""
    if not settings.AZURE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Microsoft SSO not configured")

    redirect_uri = settings.AZURE_REDIRECT_URI or f"{settings.FRONTEND_URL}/auth/microsoft/callback"
    params = {
        "client_id": settings.AZURE_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": "openid profile email User.Read",
        "state": "emcatalyst_sso",
    }
    auth_url = f"{AZURE_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"
    return {"auth_url": auth_url}


class MicrosoftCallbackRequest(BaseModel):
    code: str


@router.post("/microsoft/callback")
async def microsoft_callback(data: MicrosoftCallbackRequest, db: Session = Depends(get_db)):
    """Exchange the authorization code for tokens, get user info, and login."""
    if not settings.AZURE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Microsoft SSO not configured")

    redirect_uri = settings.AZURE_REDIRECT_URI or f"{settings.FRONTEND_URL}/auth/microsoft/callback"

    # Exchange code for access token
    token_data = {
        "client_id": settings.AZURE_CLIENT_ID,
        "client_secret": settings.AZURE_CLIENT_SECRET,
        "code": data.code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "scope": "openid profile email User.Read",
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(AZURE_TOKEN_URL, data=token_data)
        if token_resp.status_code != 200:
            detail = token_resp.json().get("error_description", "Failed to get token from Microsoft")
            raise HTTPException(status_code=400, detail=detail)

        tokens = token_resp.json()
        access_token = tokens.get("access_token")

        # Get user profile from Microsoft Graph
        graph_resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if graph_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info from Microsoft")

        ms_user = graph_resp.json()

    # Extract identifiers from Microsoft response
    # employeeId field from Azure AD, or fallback to email
    employee_id = ms_user.get("employeeId") or ms_user.get("onPremisesSamAccountName")
    email = ms_user.get("mail") or ms_user.get("userPrincipalName")

    # Try to find user by employee_id first, then by email
    user = None
    if employee_id:
        user = db.query(User).filter(User.employee_id == employee_id).first()

    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="No EMCatalyst account found for this Microsoft account. Please contact your administrator."
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    # Generate app token and return
    token = create_access_token(data={"sub": user.employee_id})
    user_data = UserOut.model_validate(user).model_dump()
    user_data["roles"] = [ra.role for ra in user.role_assignments] if user.role_assignments else []
    return {"access_token": token, "token_type": "bearer", "user": user_data}
