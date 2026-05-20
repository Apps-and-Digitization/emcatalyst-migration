from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets
import string
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.base import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRoleAssignment, Division, Territory
from app.models.brs import (
    BrsApplication, BrsStatus, BrsSurvey, BrsSurveyQuestion,
    BrsQuestionType, BrsAuditTrail, BrsDoctor, BrsTerritoryAssignment
)
from app.models.master import HcpDoctor, HcpDoctorTerritory
from app.core.security import get_password_hash

router = APIRouter(prefix="/brs", tags=["BRS"])
limiter = Limiter(key_func=get_remote_address)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _generate_brs_code(db: Session) -> str:
    from datetime import date
    prefix = f"BRS{date.today().strftime('%Y%m')}"
    last = (db.query(BrsApplication)
            .filter(BrsApplication.brs_code.like(f"{prefix}%"))
            .with_for_update()
            .order_by(desc(BrsApplication.brs_code))
            .first())
    seq = 1
    if last and last.brs_code:
        try:
            seq = int(last.brs_code[len(prefix):]) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _get_user_division_ids(db: Session, user: User) -> List[int]:
    """Get division IDs the user has access to (primary + additional assignments)"""
    if user.role == "Administrator" or user.is_superuser:
        from app.models.user import Division
        return [d.id for d in db.query(Division).all()]
    # BRS Admin sees all divisions
    if _has_role(user, "BRS Admin"):
        from app.models.user import Division
        return [d.id for d in db.query(Division).all()]
    ids = set()
    # Primary division
    if user.division_id:
        ids.add(user.division_id)
    # Additional division assignments
    if user.division_assignments:
        for da in user.division_assignments:
            ids.add(da.division_id)
    # Also include divisions from BRS apps the user created
    user_brs_divs = (
        db.query(BrsApplication.division_id)
        .filter(BrsApplication.created_by_id == user.id, BrsApplication.division_id != None)
        .distinct()
        .all()
    )
    for (div_id,) in user_brs_divs:
        ids.add(div_id)
    return list(ids) if ids else []


def _has_role(user: User, role_name: str) -> bool:
    """Check if user has a specific role (primary or additional)"""
    if user.role == role_name:
        return True
    if user.role == "Administrator" or user.is_superuser:
        return True
    return any(ra.role == role_name for ra in (user.role_assignments or []))


def _add_audit(db: Session, app_id: int, action: str, from_s: str, to_s: str,
               user_id: Optional[int] = None, remarks: str = ""):
    db.add(BrsAuditTrail(
        application_id=app_id, action=action,
        from_status=from_s, to_status=to_s,
        performed_by_id=user_id, remarks=remarks
    ))


def _generate_password(length=8):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def _deduct_brs_budget(db: Session, doc: BrsDoctor):
    """Deduct the doctor's honorarium from the BRS budget for the application's division and current quarter."""
    from app.models.budget import BrsBudget, BrsBudgetAuditTrail

    if not doc.honorarium_amount or float(doc.honorarium_amount) <= 0:
        return

    app = doc.brs_application
    if not app or not app.division_id:
        return

    # Determine current financial year quarter
    # FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    now = datetime.now(timezone.utc)
    month = now.month
    if month >= 4 and month <= 6:
        quarter = 1
        fy_year = now.year
    elif month >= 7 and month <= 9:
        quarter = 2
        fy_year = now.year
    elif month >= 10 and month <= 12:
        quarter = 3
        fy_year = now.year
    else:  # Jan-Mar
        quarter = 4
        fy_year = now.year - 1

    # Find the budget for this division + quarter
    budget = db.query(BrsBudget).filter(
        BrsBudget.division_id == app.division_id,
        BrsBudget.quarter == quarter,
        BrsBudget.year == fy_year,
        BrsBudget.is_active == True,
    ).first()

    if not budget:
        return  # No budget configured — skip deduction silently

    amount = float(doc.honorarium_amount)
    budget.utilized_budget = float(budget.utilized_budget or 0) + amount

    db.add(BrsBudgetAuditTrail(
        budget_id=budget.id,
        action="Deducted",
        amount=amount,
        description=f"Deducted ₹{amount:,.0f} for Dr. {doc.doctor_name} (BRS {app.brs_code})",
        brs_code=app.brs_code,
    ))
    db.flush()


# ─────────────────────────────────────────────
#  Survey CRUD (division-scoped)
# ─────────────────────────────────────────────

@router.get("/surveys")
def list_surveys(approved_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    div_ids = _get_user_division_ids(db, current_user)
    q = db.query(BrsSurvey).filter(BrsSurvey.is_active == True)
    if approved_only:
        q = q.filter(BrsSurvey.approval_status == "Approved")
    if div_ids:
        from sqlalchemy import or_
        q = q.filter(or_(BrsSurvey.division_id.in_(div_ids), BrsSurvey.division_id.is_(None)))
    surveys = q.order_by(desc(BrsSurvey.created_at)).all()
    # Build division lookup
    div_ids_set = {s.division_id for s in surveys if s.division_id}
    div_map = {}
    if div_ids_set:
        divs = db.query(Division).filter(Division.id.in_(div_ids_set)).all()
        div_map = {d.id: d.name for d in divs}
    return [
        {
            "id": s.id, "title": s.title, "description": s.description,
            "total_honorarium_amount": float(s.total_honorarium_amount or 0),
            "division_id": s.division_id,
            "division_name": div_map.get(s.division_id, None),
            "is_active": s.is_active,
            "approval_status": s.approval_status or "Pending Approval",
            "medical_approval_file": s.medical_approval_file,
            "ethical_approval_file": s.ethical_approval_file,
            "compliance_approval_file": s.compliance_approval_file,
            "payment_method": s.payment_method,
            "question_count": len(s.questions),
            "doctor_count": len(s.doctor_mappings) if s.doctor_mappings else 0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in surveys
    ]


@router.post("/surveys")
def create_survey(
    title: str, description: str = "", total_honorarium_amount: float = 0,
    division_id: Optional[int] = None,
    agreement_template: str = "", requires_agreement_download: bool = True,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    survey = BrsSurvey(
        title=title, description=description,
        total_honorarium_amount=total_honorarium_amount,
        division_id=division_id,
        agreement_template=agreement_template,
        requires_agreement_download=requires_agreement_download,
        payment_method=payment_method,
        created_by_id=current_user.id
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"id": survey.id, "title": survey.title}


@router.get("/surveys/{survey_id}")
def get_survey(survey_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    division_name = None
    if s.division_id:
        div = db.query(Division).filter(Division.id == s.division_id).first()
        division_name = div.name if div else None
    return {
        "id": s.id, "title": s.title, "description": s.description,
        "total_honorarium_amount": float(s.total_honorarium_amount or 0),
        "division_id": s.division_id,
        "division_name": division_name,
        "is_active": s.is_active,
        "approval_status": s.approval_status or "Pending Approval",
        "medical_approval_file": s.medical_approval_file,
        "ethical_approval_file": s.ethical_approval_file,
        "compliance_approval_file": s.compliance_approval_file,
        "payment_method": s.payment_method,
        "requires_agreement_download": s.requires_agreement_download,
        "agreement_template": s.agreement_template or "",
        "questions": [
            {
                "id": q.id, "order_no": q.order_no, "question_text": q.question_text,
                "question_type": q.question_type, "options": q.options or [],
                "is_required": q.is_required, "min_duration_seconds": q.min_duration_seconds,
                "video_url": q.video_url or ""
            }
            for q in s.questions
        ]
    }


@router.put("/surveys/{survey_id}")
def update_survey(
    survey_id: int, title: str = None, description: str = None,
    total_honorarium_amount: float = None, division_id: int = None,
    agreement_template: str = None, requires_agreement_download: bool = None,
    payment_method: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    if title is not None: s.title = title
    if description is not None: s.description = description
    if total_honorarium_amount is not None: s.total_honorarium_amount = total_honorarium_amount
    if division_id is not None: s.division_id = division_id
    if agreement_template is not None: s.agreement_template = agreement_template
    if requires_agreement_download is not None: s.requires_agreement_download = requires_agreement_download
    if payment_method is not None: s.payment_method = payment_method
    if is_active is not None: s.is_active = is_active
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/surveys/{survey_id}/upload-approval")
def upload_survey_approval(
    survey_id: int,
    document_type: str = Form(...),  # medical_approval or ethical_approval
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload Medical Team Approval, Ethics Committee Approval, or Compliance Team Approval document for a survey."""
    import os, uuid, shutil

    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")

    if document_type not in ("medical_approval", "ethical_approval", "compliance_approval"):
        raise HTTPException(400, "document_type must be 'medical_approval', 'ethical_approval', or 'compliance_approval'")

    # Save file
    upload_dir = os.path.join("uploads", "survey_approvals", str(survey_id))
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
    filename = f"{document_type}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Update survey record
    if document_type == "medical_approval":
        s.medical_approval_file = file_path
    elif document_type == "ethical_approval":
        s.ethical_approval_file = file_path
    else:
        s.compliance_approval_file = file_path

    # Auto-approve if all three documents are uploaded
    if s.medical_approval_file and s.ethical_approval_file and s.compliance_approval_file:
        s.approval_status = "Approved"

    db.commit()
    return {
        "ok": True,
        "document_type": document_type,
        "file_path": file_path,
        "approval_status": s.approval_status,
    }


@router.delete("/surveys/{survey_id}/approval-document/{document_type}")
def remove_survey_approval_document(
    survey_id: int,
    document_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove an uploaded approval document and revert approval status."""
    import os

    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")

    if document_type not in ("medical_approval", "ethical_approval", "compliance_approval"):
        raise HTTPException(400, "document_type must be 'medical_approval', 'ethical_approval', or 'compliance_approval'")

    # Delete the file
    if document_type == "medical_approval":
        file_path = s.medical_approval_file
    elif document_type == "ethical_approval":
        file_path = s.ethical_approval_file
    else:
        file_path = s.compliance_approval_file

    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Clear the field
    if document_type == "medical_approval":
        s.medical_approval_file = None
    elif document_type == "ethical_approval":
        s.ethical_approval_file = None
    else:
        s.compliance_approval_file = None

    # Revert approval status since a document is now missing
    s.approval_status = "Pending Approval"
    db.commit()

    return {"ok": True, "approval_status": s.approval_status}


@router.delete("/surveys/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin only — delete a survey and all its questions."""
    if current_user.role != "Administrator" and not current_user.is_superuser:
        raise HTTPException(403, "Only Administrator can delete surveys")
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    # Check if any BRS uses this survey
    linked = db.query(BrsApplication).filter(BrsApplication.survey_id == survey_id).count()
    if linked > 0:
        raise HTTPException(400, f"Cannot delete — {linked} BRS application(s) use this survey. Deactivate instead.")
    db.query(BrsSurveyQuestion).filter(BrsSurveyQuestion.survey_id == survey_id).delete()
    db.delete(s)
    db.commit()
    return {"message": "Survey deleted"}


# Survey Doctor Mappings
@router.get("/surveys/{survey_id}/doctors")
def list_survey_doctors(survey_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all doctors mapped to this survey."""
    from app.models.brs import SurveyDoctorMapping
    from app.models.master import HcpDoctor
    mappings = db.query(SurveyDoctorMapping).filter(SurveyDoctorMapping.survey_id == survey_id).all()
    result = []
    for m in mappings:
        doc = db.query(HcpDoctor).filter(HcpDoctor.id == m.hcp_doctor_id).first()
        if doc:
            result.append({
                "mapping_id": m.id,
                "hcp_doctor_id": doc.id,
                "uid_number": doc.uid_number,
                "full_name": doc.full_name or f"{doc.first_name or ''} {doc.last_name or ''}".strip(),
                "speciality": doc.speciality,
                "email": doc.email,
                "mobile_number": doc.mobile_number,
                "pan_number": doc.pan_number,
                "city": doc.city,
            })
    return result


@router.post("/surveys/{survey_id}/doctors")
def add_survey_doctors(survey_id: int, doctor_ids: List[int] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Map doctors to a survey (bulk add by hcp_doctor_id list)."""
    from app.models.brs import SurveyDoctorMapping
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    added = 0
    for doc_id in doctor_ids:
        existing = db.query(SurveyDoctorMapping).filter(
            SurveyDoctorMapping.survey_id == survey_id,
            SurveyDoctorMapping.hcp_doctor_id == doc_id
        ).first()
        if not existing:
            db.add(SurveyDoctorMapping(survey_id=survey_id, hcp_doctor_id=doc_id))
            added += 1
    db.commit()
    return {"added": added, "total": db.query(SurveyDoctorMapping).filter(SurveyDoctorMapping.survey_id == survey_id).count()}


@router.delete("/surveys/{survey_id}/doctors/{doctor_id}")
def remove_survey_doctor(survey_id: int, doctor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Remove a doctor mapping from a survey."""
    from app.models.brs import SurveyDoctorMapping
    m = db.query(SurveyDoctorMapping).filter(
        SurveyDoctorMapping.survey_id == survey_id,
        SurveyDoctorMapping.hcp_doctor_id == doctor_id
    ).first()
    if not m:
        raise HTTPException(404, "Mapping not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/surveys/{survey_id}/doctors/import")
def import_survey_doctors_by_uid(survey_id: int, uids: List[str] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Map doctors to a survey by UID numbers (bulk)."""
    from app.models.brs import SurveyDoctorMapping
    from app.models.master import HcpDoctor
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    added = 0
    not_found = []
    for uid in uids:
        uid = uid.strip()
        doc = db.query(HcpDoctor).filter(HcpDoctor.uid_number == uid).first()
        if not doc:
            not_found.append(uid)
            continue
        existing = db.query(SurveyDoctorMapping).filter(
            SurveyDoctorMapping.survey_id == survey_id,
            SurveyDoctorMapping.hcp_doctor_id == doc.id
        ).first()
        if not existing:
            db.add(SurveyDoctorMapping(survey_id=survey_id, hcp_doctor_id=doc.id))
            added += 1
    db.commit()
    return {"added": added, "not_found": not_found, "total": db.query(SurveyDoctorMapping).filter(SurveyDoctorMapping.survey_id == survey_id).count()}


# Survey Questions
@router.post("/surveys/{survey_id}/questions")
def add_question(
    survey_id: int, question_text: str,
    question_type: BrsQuestionType = BrsQuestionType.FREE_TEXT,
    options: List[str] = None, is_required: bool = True,
    min_duration_seconds: int = 0, video_url: str = "",
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    max_order = db.query(func.max(BrsSurveyQuestion.order_no)).filter(BrsSurveyQuestion.survey_id == survey_id).scalar() or 0
    q = BrsSurveyQuestion(
        survey_id=survey_id, question_text=question_text,
        question_type=question_type, options=options or [],
        is_required=is_required, min_duration_seconds=min_duration_seconds,
        video_url=video_url, order_no=max_order + 1
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return {"id": q.id, "order_no": q.order_no}


@router.delete("/surveys/{survey_id}/questions/{question_id}")
def delete_question(survey_id: int, question_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(BrsSurveyQuestion).filter(BrsSurveyQuestion.id == question_id, BrsSurveyQuestion.survey_id == survey_id).first()
    if not q:
        raise HTTPException(404, "Question not found")
    db.delete(q)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
#  BRS Applications (Marketing Head creates)
# ─────────────────────────────────────────────

@router.get("/")
def list_applications(
    status: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    div_ids = _get_user_division_ids(db, current_user)
    q = db.query(BrsApplication)
    if div_ids:
        q = q.filter(BrsApplication.division_id.in_(div_ids))
    if status:
        q = q.filter(BrsApplication.status == status)
    total = q.count()
    apps = q.order_by(desc(BrsApplication.created_at)).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": a.id, "brs_code": a.brs_code, "title": a.title,
                "status": a.status, "division_id": a.division_id,
                "survey_title": a.survey.title if a.survey else None,
                "doctor_count": len(a.doctors),
                "created_by_name": f"{a.created_by.first_name} {a.created_by.last_name}" if a.created_by else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in apps
        ]
    }


@router.post("/")
def create_application(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new BRS — access controlled via workflow initiator role"""
    from app.services.workflow_service import get_workflow, can_user_initiate
    wf = get_workflow(db, "brs_approval")
    if wf and not can_user_initiate(db, current_user, wf):
        raise HTTPException(403, "You are not authorized to create BRS")

    survey_id = data.get("survey_id")
    if not survey_id:
        raise HTTPException(400, "survey_id is required")

    survey = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")

    app = BrsApplication(
        brs_code=_generate_brs_code(db),
        survey_id=survey_id,
        division_id=data.get("division_id") or survey.division_id or current_user.division_id,
        title=data.get("title", survey.title),
        remarks=data.get("remarks"),
        therapeutic_area=data.get("therapeutic_area"),
        brand=data.get("brand"),
        budget_type=data.get("budget_type"),
        platform=data.get("platform"),
        topic=data.get("topic"),
        on_field_execution_by=data.get("on_field_execution_by"),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        city=data.get("city"),
        venue=data.get("venue"),
        rationale=data.get("rationale"),
        agenda=data.get("agenda"),
        cost_center=data.get("cost_center"),
        status=BrsStatus.DRAFT,
        created_by_id=current_user.id,
    )
    db.add(app)
    db.flush()
    _add_audit(db, app.id, "Created", "", BrsStatus.DRAFT, current_user.id)
    db.commit()
    db.refresh(app)
    return {"id": app.id, "brs_code": app.brs_code}


@router.get("/check-budget")
def check_brs_budget(
    division_id: int,
    start_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if BRS budget exists for the given division and quarter (derived from start_date).
    Returns budget info or error if not configured."""
    from app.models.budget import BrsBudget
    from datetime import datetime as dt

    try:
        parsed = dt.fromisoformat(start_date.replace('Z', '+00:00')) if 'T' in start_date else dt.strptime(start_date, "%Y-%m-%d")
    except Exception:
        raise HTTPException(400, "Invalid date format")

    month = parsed.month
    # Financial year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    if 4 <= month <= 6:
        quarter = 1
        fy_year = parsed.year
    elif 7 <= month <= 9:
        quarter = 2
        fy_year = parsed.year
    elif 10 <= month <= 12:
        quarter = 3
        fy_year = parsed.year
    else:
        quarter = 4
        fy_year = parsed.year - 1

    budget = db.query(BrsBudget).filter(
        BrsBudget.division_id == division_id,
        BrsBudget.quarter == quarter,
        BrsBudget.year == fy_year,
        BrsBudget.is_active == True,
    ).first()

    if not budget:
        return {
            "has_budget": False,
            "error": f"No BRS budget configured for this division in Q{quarter} (FY {fy_year}–{str(fy_year+1)[2:]}). Please configure budget first.",
            "quarter": quarter,
            "fy_year": fy_year,
        }

    available = float(budget.allocated_budget) - float(budget.utilized_budget or 0)
    return {
        "has_budget": True,
        "budget_id": budget.id,
        "quarter": quarter,
        "fy_year": fy_year,
        "allocated": float(budget.allocated_budget),
        "utilized": float(budget.utilized_budget or 0),
        "available": available,
    }


@router.get("/dashboard")
def brs_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    div_ids = _get_user_division_ids(db, current_user)
    q = db.query(BrsApplication)
    if div_ids:
        q = q.filter(BrsApplication.division_id.in_(div_ids))

    total = q.count()
    draft = q.filter(BrsApplication.status == BrsStatus.DRAFT).count()
    submitted = q.filter(BrsApplication.status == BrsStatus.SUBMITTED).count()
    approved = q.filter(BrsApplication.status == BrsStatus.DH_APPROVED).count()
    doctor_pending = q.filter(BrsApplication.status == BrsStatus.DOCTOR_PENDING).count()
    completed = q.filter(BrsApplication.status == BrsStatus.COMPLETED).count()
    verified = q.filter(BrsApplication.status == BrsStatus.VERIFIED).count()

    return {
        "total": total, "draft": draft, "submitted": submitted,
        "approved": approved, "doctor_pending": doctor_pending,
        "completed": completed, "verified": verified,
    }


# ─────────────────────────────────────────────
#  Survey Analytics
# ─────────────────────────────────────────────

@router.get("/surveys/{survey_id}/analytics")
def survey_analytics(survey_id: int, brs_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get aggregated analytics for a survey's responses. Optionally filter by a specific BRS application."""
    survey = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")

    # Find BRS applications using this survey (optionally filtered by brs_id)
    app_query = db.query(BrsApplication).filter(BrsApplication.survey_id == survey_id)
    if brs_id:
        app_query = app_query.filter(BrsApplication.id == brs_id)
    applications = app_query.all()
    app_ids = [a.id for a in applications]

    # Get all doctors from those applications
    all_doctors = []
    if app_ids:
        all_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id.in_(app_ids)).all()

    total_doctors_assigned = len(all_doctors)
    completed_doctors = [d for d in all_doctors if d.survey_completed_at is not None]
    total_completed = len(completed_doctors)
    completion_rate = round((total_completed / total_doctors_assigned * 100), 1) if total_doctors_assigned > 0 else 0.0

    # Get survey questions
    questions = db.query(BrsSurveyQuestion).filter(
        BrsSurveyQuestion.survey_id == survey_id
    ).order_by(BrsSurveyQuestion.order_no).all()

    # Aggregate responses per question
    question_analytics = []
    for q in questions:
        q_id_str = str(q.id)
        q_type = q.question_type

        if q_type in ("single_select", "multi_select"):
            # Count occurrences of each option
            option_counts = {}
            for opt in (q.options or []):
                option_counts[opt] = 0

            total_responses = 0
            for doc in completed_doctors:
                responses = doc.survey_responses or {}
                answer = None
                if q_id_str in responses:
                    val = responses[q_id_str]
                    if isinstance(val, dict):
                        answer = val.get("answer")
                    else:
                        answer = val

                if answer is not None:
                    total_responses += 1
                    if q_type == "multi_select" and isinstance(answer, list):
                        for a in answer:
                            option_counts[a] = option_counts.get(a, 0) + 1
                    else:
                        option_counts[answer] = option_counts.get(answer, 0) + 1

            question_analytics.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q_type,
                "options": q.options or [],
                "responses": option_counts,
                "total_responses": total_responses,
            })
        else:
            # free_text / fill_in_blanks — collect all text responses
            text_responses = []
            for doc in completed_doctors:
                responses = doc.survey_responses or {}
                answer = None
                if q_id_str in responses:
                    val = responses[q_id_str]
                    if isinstance(val, dict):
                        answer = val.get("answer")
                    else:
                        answer = val

                if answer is not None and str(answer).strip():
                    text_responses.append(str(answer))

            question_analytics.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q_type,
                "text_responses": text_responses,
                "total_responses": len(text_responses),
            })

    # Build individual doctor responses
    individual_responses = []
    for doc in completed_doctors:
        responses = doc.survey_responses or {}
        doc_answers = {}
        for q in questions:
            q_id_str = str(q.id)
            answer = ""
            if q_id_str in responses:
                val = responses[q_id_str]
                if isinstance(val, dict):
                    answer = val.get("answer", "")
                else:
                    answer = val
                if isinstance(answer, list):
                    answer = ", ".join(str(a) for a in answer)
            doc_answers[str(q.id)] = str(answer) if answer else ""
        individual_responses.append({
            "doctor_name": doc.doctor_name,
            "email": doc.email,
            "speciality": doc.speciality,
            "brs_id": doc.brs_application_id,
            "completed_at": doc.survey_completed_at.isoformat() if doc.survey_completed_at else None,
            "answers": doc_answers,
        })

    # Also include all assigned doctors (not just completed) for BRS-wise counts
    all_doctor_brs_map = []
    for doc in all_doctors:
        all_doctor_brs_map.append({
            "brs_id": doc.brs_application_id,
            "completed_at": doc.survey_completed_at.isoformat() if doc.survey_completed_at else None,
        })

    return {
        "survey_title": survey.title,
        "total_doctors_assigned": total_doctors_assigned,
        "total_completed": total_completed,
        "completion_rate": completion_rate,
        "questions": question_analytics,
        "individual_responses": individual_responses,
        "all_doctor_brs_map": all_doctor_brs_map,
        "brs_applications": [
            {"id": a.id, "brs_code": a.brs_code, "title": a.title, "status": a.status}
            for a in db.query(BrsApplication).filter(BrsApplication.survey_id == survey_id).order_by(desc(BrsApplication.created_at)).all()
        ],
    }


@router.get("/surveys/{survey_id}/analytics/export")
def survey_analytics_export(survey_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export survey responses as an Excel file with BRS summary and doctor responses."""
    from fastapi.responses import StreamingResponse
    from openpyxl import Workbook
    from io import BytesIO

    survey = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")

    # Get questions
    questions = db.query(BrsSurveyQuestion).filter(
        BrsSurveyQuestion.survey_id == survey_id
    ).order_by(BrsSurveyQuestion.order_no).all()

    # Find all BRS applications using this survey
    applications = db.query(BrsApplication).filter(BrsApplication.survey_id == survey_id).all()
    app_ids = [a.id for a in applications]
    app_map = {a.id: a for a in applications}

    # Get all doctors (not just completed)
    all_doctors = []
    if app_ids:
        all_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id.in_(app_ids)).all()

    # Build Excel
    wb = Workbook()

    # Sheet 1: BRS Summary
    ws_summary = wb.active
    ws_summary.title = "BRS Summary"
    ws_summary.append(["BRS Code", "Title", "Status", "Total Doctors", "Completed", "Pending", "Completion %"])
    for app in applications:
        app_doctors = [d for d in all_doctors if d.brs_application_id == app.id]
        completed = sum(1 for d in app_doctors if d.survey_completed_at)
        pending = len(app_doctors) - completed
        pct = round((completed / len(app_doctors) * 100), 1) if app_doctors else 0
        ws_summary.append([app.brs_code, app.title, app.status, len(app_doctors), completed, pending, f"{pct}%"])

    # Sheet 2: Doctor Responses
    ws_responses = wb.create_sheet("Doctor Responses")
    headers = ["BRS Code", "BRS Title", "Doctor Name", "Email", "Mobile", "Speciality", "Status", "Completed At"]
    for q in questions:
        headers.append(f"Q{q.order_no}: {q.question_text[:50]}")
    ws_responses.append(headers)

    for doc in all_doctors:
        app = app_map.get(doc.brs_application_id)
        row = [
            app.brs_code if app else "",
            app.title if app else "",
            doc.doctor_name,
            doc.email or "",
            doc.mobile or "",
            doc.speciality or "",
            doc.doctor_status or "",
            doc.survey_completed_at.strftime("%Y-%m-%d %H:%M") if doc.survey_completed_at else "",
        ]
        responses = doc.survey_responses or {}
        for q in questions:
            q_id_str = str(q.id)
            answer = ""
            if q_id_str in responses:
                val = responses[q_id_str]
                if isinstance(val, dict):
                    answer = val.get("answer", "")
                else:
                    answer = val
                if isinstance(answer, list):
                    answer = ", ".join(str(a) for a in answer)
            row.append(str(answer) if answer else "")
        ws_responses.append(row)

    # Auto-size columns for both sheets
    for ws in [ws_summary, ws_responses]:
        for col in ws.columns:
            max_length = 0
            col_letter = col[0].column_letter
            for cell in col:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            ws.column_dimensions[col_letter].width = min(max_length + 2, 50)

    # Save to buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"{survey.title[:40].replace(' ', '_')}_Analytics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─────────────────────────────────────────────
#  Territory Assignments
# ─────────────────────────────────────────────

@router.get("/{app_id}/territory-assignments")
def get_territory_assignments(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get territory groups for a BRS — each doctor placed in ONE group (first territory)."""
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")

    brs_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).all()

    # Place each doctor in ONE group only (first territory or "No Territory")
    territory_groups = {}  # {territory_id or None: [doctor, ...]}
    assigned_doctors = set()  # track which doctors are already placed

    for doc in brs_doctors:
        if doc.id in assigned_doctors:
            continue
        if doc.hcp_doctor_id:
            doc_territories = db.query(HcpDoctorTerritory).filter(
                HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id
            ).order_by(HcpDoctorTerritory.id).all()
            if doc_territories:
                # Use FIRST territory only
                first_territory_id = doc_territories[0].territory_id
                territory_groups.setdefault(first_territory_id, []).append(doc)
            else:
                territory_groups.setdefault(None, []).append(doc)
        else:
            territory_groups.setdefault(None, []).append(doc)
        assigned_doctors.add(doc.id)

    # Build territory name lookup
    territory_ids = [tid for tid in territory_groups.keys() if tid is not None]
    territory_map = {}
    if territory_ids:
        territories = db.query(Territory).filter(Territory.id.in_(territory_ids)).all()
        territory_map = {t.id: t.name for t in territories}

    # Get existing assignments
    existing_assignments = db.query(BrsTerritoryAssignment).filter(
        BrsTerritoryAssignment.brs_application_id == app_id
    ).all()
    assignment_map = {a.territory_id: a for a in existing_assignments}

    # Build user name lookup
    assigned_user_ids = [a.assigned_user_id for a in existing_assignments if a.assigned_user_id]
    user_map = {}
    if assigned_user_ids:
        users = db.query(User).filter(User.id.in_(assigned_user_ids)).all()
        user_map = {u.id: f"{u.first_name or ''} {u.last_name or ''}".strip() for u in users}

    result = []
    for territory_id, docs in territory_groups.items():
        assignment = assignment_map.get(territory_id)
        result.append({
            "territory_id": territory_id,
            "territory_name": territory_map.get(territory_id, "No Territory") if territory_id else "No Territory",
            "doctor_count": len(docs),
            "doctors": [
                {
                    "id": d.id, "doctor_name": d.doctor_name,
                    "name_as_per_pan": d.name_as_per_pan, "pan_number": d.pan_number,
                    "email": d.email, "mobile": d.mobile, "speciality": d.speciality,
                    "honorarium_amount": float(d.honorarium_amount or 0),
                }
                for d in docs
            ],
            "assignment_id": assignment.id if assignment else None,
            "assigned_user_id": assignment.assigned_user_id if assignment else None,
            "assigned_user_name": user_map.get(assignment.assigned_user_id, "") if assignment and assignment.assigned_user_id else None,
            "email_status": assignment.email_status if assignment else "pending",
            "email_sent_at": assignment.email_sent_at.isoformat() if assignment and assignment.email_sent_at else None,
        })

    result.sort(key=lambda x: (x["territory_id"] is None, x["territory_name"]))
    return result


@router.post("/{app_id}/territory-assignments")
def save_territory_assignments(app_id: int, data: List[dict] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Upsert territory assignments for this BRS."""
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")

    for item in data:
        territory_id = item.get("territory_id")  # can be None
        assigned_user_id = item.get("assigned_user_id")

        existing = db.query(BrsTerritoryAssignment).filter(
            BrsTerritoryAssignment.brs_application_id == app_id,
            BrsTerritoryAssignment.territory_id == territory_id,
        ).first()

        if existing:
            existing.assigned_user_id = assigned_user_id
        else:
            # Count doctors for this territory
            brs_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).all()
            doc_count = 0
            for doc in brs_doctors:
                if doc.hcp_doctor_id:
                    if territory_id is not None:
                        has_territory = db.query(HcpDoctorTerritory).filter(
                            HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id,
                            HcpDoctorTerritory.territory_id == territory_id,
                        ).first()
                        if has_territory:
                            doc_count += 1
                    else:
                        # "No Territory" group: doctors with no territory mapping
                        has_any = db.query(HcpDoctorTerritory).filter(
                            HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id
                        ).first()
                        if not has_any:
                            doc_count += 1
                else:
                    if territory_id is None:
                        doc_count += 1

            db.add(BrsTerritoryAssignment(
                brs_application_id=app_id,
                territory_id=territory_id,
                assigned_user_id=assigned_user_id,
                doctor_count=doc_count,
            ))

    db.commit()
    return {"ok": True}


@router.post("/{app_id}/territory-assignments/{assignment_id}/resend-email")
def resend_territory_email(app_id: int, assignment_id: int, background_tasks: BackgroundTasks = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Resend credentials email for a specific territory assignment."""
    from app.core.email import send_brs_credentials_to_territory_manager
    from app.core.config import settings

    assignment = db.query(BrsTerritoryAssignment).filter(
        BrsTerritoryAssignment.id == assignment_id,
        BrsTerritoryAssignment.brs_application_id == app_id,
    ).first()
    if not assignment:
        raise HTTPException(404, "Assignment not found")

    if not assignment.assigned_user_id:
        raise HTTPException(400, "No user assigned to this territory")

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")

    tm_user = db.query(User).filter(User.id == assignment.assigned_user_id).first()
    if not tm_user or not tm_user.email:
        raise HTTPException(400, "Assigned user has no email address")

    # Get doctors for this territory
    brs_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).all()
    territory_doctors = []
    for doc in brs_doctors:
        if doc.hcp_doctor_id:
            if assignment.territory_id is not None:
                has_territory = db.query(HcpDoctorTerritory).filter(
                    HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id,
                    HcpDoctorTerritory.territory_id == assignment.territory_id,
                ).first()
                if has_territory:
                    territory_doctors.append(doc)
            else:
                has_any = db.query(HcpDoctorTerritory).filter(
                    HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id
                ).first()
                if not has_any:
                    territory_doctors.append(doc)
        else:
            if assignment.territory_id is None:
                territory_doctors.append(doc)

    if not territory_doctors:
        raise HTTPException(400, "No doctors found for this territory")

    # Build credentials list (use existing credentials — they were generated on approval)
    doctor_credentials = []
    portal_url = f"{settings.FRONTEND_URL}/brs/doctor-login"
    for doc in territory_doctors:
        if doc.login_id:
            # We can't retrieve the plain password after hashing, so generate a new one
            password = _generate_password()
            doc.login_password = get_password_hash(password)
            doctor_credentials.append({
                "doctor_name": doc.doctor_name,
                "email": doc.email,
                "mobile": doc.mobile,
                "speciality": doc.speciality,
                "login_id": doc.login_id,
                "password": password,
            })

    if not doctor_credentials:
        raise HTTPException(400, "No credentials found. BRS may not be approved yet.")

    assignment.email_status = "sent"
    assignment.email_sent_at = datetime.now(timezone.utc)
    db.commit()

    if background_tasks:
        background_tasks.add_task(
            send_brs_credentials_to_territory_manager,
            tm_email=tm_user.email,
            tm_name=f"{tm_user.first_name or ''} {tm_user.last_name or ''}".strip(),
            brs_code=app.brs_code,
            brs_title=app.title,
            survey_title=app.survey.title if app.survey else "BRS Survey",
            doctor_credentials=doctor_credentials,
            portal_url=portal_url,
        )

    return {"ok": True, "message": f"Email sent to {tm_user.email}"}


@router.get("/{app_id}")
def get_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not a:
        raise HTTPException(404, "BRS not found")
    return {
        "id": a.id, "brs_code": a.brs_code, "title": a.title,
        "status": a.status, "division_id": a.division_id,
        "remarks": a.remarks,
        "therapeutic_area": a.therapeutic_area,
        "brand": a.brand,
        "budget_type": a.budget_type,
        "platform": a.platform,
        "topic": a.topic,
        "on_field_execution_by": a.on_field_execution_by,
        "start_date": a.start_date.isoformat() if a.start_date else None,
        "end_date": a.end_date.isoformat() if a.end_date else None,
        "city": a.city,
        "venue": a.venue,
        "rationale": a.rationale,
        "agenda": a.agenda,
        "cost_center": a.cost_center,
        "survey_id": a.survey_id,
        "survey_title": a.survey.title if a.survey else None,
        "total_honorarium_amount": float(a.survey.total_honorarium_amount or 0) if a.survey else 0,
        "created_by": {"id": a.created_by.id, "name": f"{a.created_by.first_name} {a.created_by.last_name}"} if a.created_by else None,
        "approved_by": {"id": a.approved_by.id, "name": f"{a.approved_by.first_name} {a.approved_by.last_name}"} if a.approved_by else None,
        "approved_at": a.approved_at.isoformat() if a.approved_at else None,
        "rejection_reason": a.rejection_reason,
        "doctors": [
            {
                "id": d.id, "doctor_name": d.doctor_name,
                "name_as_per_pan": d.name_as_per_pan, "pan_number": d.pan_number,
                "email": d.email, "mobile": d.mobile, "speciality": d.speciality,
                "honorarium_amount": float(d.honorarium_amount or 0),
                "doctor_status": d.doctor_status,
                "hcp_doctor_id": d.hcp_doctor_id,
                "agreement_signed_at": d.agreement_signed_at.isoformat() if d.agreement_signed_at else None,
                "has_signature": bool(d.agreement_signature),
                "survey_completed_at": d.survey_completed_at.isoformat() if d.survey_completed_at else None,
                "survey_responses": d.survey_responses,
                "uploaded_documents": [
                    {"id": doc.id, "document_type": doc.document_type, "document_name": doc.document_name, "file_path": doc.file_path}
                    for doc in (d.documents or [])
                ],
            }
            for d in a.doctors
        ],
        "audit_trail": [
            {
                "action": t.action, "from_status": t.from_status, "to_status": t.to_status,
                "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else "System",
                "remarks": t.remarks,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in a.audit_trail
        ],
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "is_bulk_imported": any(t.action == "Bulk Created" for t in a.audit_trail),
        "application_documents": [
            {
                "id": d.id, "document_name": d.document_name, "file_path": d.file_path,
                "mime_type": d.mime_type,
                "uploaded_by": f"{d.uploaded_by.first_name} {d.uploaded_by.last_name}" if d.uploaded_by else None,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in (a.application_documents or [])
        ],
        "territory_assignments": [
            {
                "id": ta.id,
                "territory_id": ta.territory_id,
                "territory_name": ta.territory.name if ta.territory else "No Territory",
                "assigned_user_id": ta.assigned_user_id,
                "assigned_user_name": f"{ta.assigned_user.first_name or ''} {ta.assigned_user.last_name or ''}".strip() if ta.assigned_user else None,
                "doctor_count": ta.doctor_count,
                "email_status": ta.email_status,
                "email_sent_at": ta.email_sent_at.isoformat() if ta.email_sent_at else None,
            }
            for ta in (a.territory_assignments or [])
        ],
    }


@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin only — delete a BRS application and all related data."""
    if current_user.role != "Administrator" and not current_user.is_superuser:
        raise HTTPException(403, "Only Administrator can delete BRS")
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    # Delete related records
    from app.models.brs import BrsDoctorDocument
    for doc in app.doctors:
        db.query(BrsDoctorDocument).filter(BrsDoctorDocument.brs_doctor_id == doc.id).delete()
    db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).delete()
    db.query(BrsAuditTrail).filter(BrsAuditTrail.application_id == app_id).delete()
    db.delete(app)
    db.commit()
    return {"message": "BRS deleted"}


@router.get("/{app_id}/can-approve")
def can_approve_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check if current user can approve/reject this BRS at its current status."""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")

    if app.status != BrsStatus.SUBMITTED:
        return {"can_approve": False, "reason": "BRS is not in Submitted status"}

    step = get_step_for_status(db, "brs_approval", BrsStatus.SUBMITTED)
    if not step:
        return {"can_approve": False, "reason": "No approval workflow step configured for this status"}

    can = can_user_approve_step(db, current_user, step, app.created_by_id)
    return {"can_approve": can, "step_label": step.step_label, "reason": "" if can else "You are not authorized for this approval step"}


# ─────────────────────────────────────────────
#  Doctor Management (within a BRS)
# ─────────────────────────────────────────────

@router.post("/{app_id}/doctors")
def add_doctor(app_id: int, data: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Marketing Head adds a doctor to BRS"""
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.DRAFT:
        raise HTTPException(400, "Can only add doctors in Draft status")

    # Honorarium limit validation
    new_honorarium = float(data.get("honorarium_amount") or 0)
    if app.survey and app.survey.total_honorarium_amount and app.survey.total_honorarium_amount > 0:
        existing_total = sum(float(d.honorarium_amount or 0) for d in app.doctors)
        if existing_total + new_honorarium > float(app.survey.total_honorarium_amount):
            raise HTTPException(
                400,
                f"Total honorarium (₹{existing_total + new_honorarium:,.0f}) would exceed survey limit of ₹{float(app.survey.total_honorarium_amount):,.0f}"
            )

    doc = BrsDoctor(
        brs_application_id=app_id,
        hcp_doctor_id=data.get("hcp_doctor_id"),
        doctor_name=data["doctor_name"],
        name_as_per_pan=data.get("name_as_per_pan"),
        pan_number=data.get("pan_number"),
        email=data.get("email"),
        mobile=data.get("mobile"),
        speciality=data.get("speciality"),
        honorarium_amount=data.get("honorarium_amount"),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "doctor_name": doc.doctor_name}


@router.put("/{app_id}/doctors/{doctor_id}")
def update_doctor(app_id: int, doctor_id: int, data: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(BrsDoctor).filter(BrsDoctor.id == doctor_id, BrsDoctor.brs_application_id == app_id).first()
    if not doc:
        raise HTTPException(404, "Doctor not found")

    # Honorarium limit validation if honorarium is being updated
    if "honorarium_amount" in data and data["honorarium_amount"] is not None:
        app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
        if app and app.survey and app.survey.total_honorarium_amount and app.survey.total_honorarium_amount > 0:
            new_honorarium = float(data["honorarium_amount"])
            existing_total = sum(float(d.honorarium_amount or 0) for d in app.doctors if d.id != doctor_id)
            if existing_total + new_honorarium > float(app.survey.total_honorarium_amount):
                raise HTTPException(
                    400,
                    f"Total honorarium (₹{existing_total + new_honorarium:,.0f}) would exceed survey limit of ₹{float(app.survey.total_honorarium_amount):,.0f}"
                )

    for field in ["doctor_name", "name_as_per_pan", "pan_number", "email", "mobile", "speciality", "honorarium_amount"]:
        if field in data and data[field] is not None:
            setattr(doc, field, data[field])
    db.commit()
    return {"ok": True}


@router.delete("/{app_id}/doctors/{doctor_id}")
def remove_doctor(app_id: int, doctor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(BrsDoctor).filter(BrsDoctor.id == doctor_id, BrsDoctor.brs_application_id == app_id).first()
    if not doc:
        raise HTTPException(404, "Doctor not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
#  Workflow Actions
# ─────────────────────────────────────────────

@router.post("/{app_id}/submit")
def submit_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Submit BRS for approval — only the workflow initiator role can submit"""
    from app.services.workflow_service import get_workflow, can_user_initiate
    wf = get_workflow(db, "brs_approval")
    if wf and not can_user_initiate(db, current_user, wf):
        raise HTTPException(403, "You are not authorized to submit this BRS")

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.DRAFT:
        raise HTTPException(400, "Only Draft BRS can be submitted")
    if not app.doctors:
        raise HTTPException(400, "At least one doctor must be added before submission")

    # Honorarium limit validation on submit
    if app.survey and app.survey.total_honorarium_amount and app.survey.total_honorarium_amount > 0:
        # Re-query doctors to get fresh data
        fresh_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).all()
        total_honorarium = sum(float(d.honorarium_amount or 0) for d in fresh_doctors)
        if total_honorarium > float(app.survey.total_honorarium_amount):
            raise HTTPException(
                400,
                f"Total honorarium (₹{total_honorarium:,.0f}) exceeds survey limit of ₹{float(app.survey.total_honorarium_amount):,.0f}. Please reduce doctor honorariums before submitting."
            )

    # BRS Budget validation on submit
    if app.division_id and app.start_date:
        from app.models.budget import BrsBudget
        fresh_doctors = db.query(BrsDoctor).filter(BrsDoctor.brs_application_id == app_id).all()
        total_honorarium = sum(float(d.honorarium_amount or 0) for d in fresh_doctors)
        month = app.start_date.month
        if 4 <= month <= 6:
            q_num, fy = 1, app.start_date.year
        elif 7 <= month <= 9:
            q_num, fy = 2, app.start_date.year
        elif 10 <= month <= 12:
            q_num, fy = 3, app.start_date.year
        else:
            q_num, fy = 4, app.start_date.year - 1

        budget = db.query(BrsBudget).filter(
            BrsBudget.division_id == app.division_id,
            BrsBudget.quarter == q_num,
            BrsBudget.year == fy,
            BrsBudget.is_active == True,
        ).first()

        if not budget:
            raise HTTPException(400, f"No BRS budget configured for this division in Q{q_num} FY {fy}. Please configure budget first.")

        available = float(budget.allocated_budget) - float(budget.utilized_budget or 0)
        if total_honorarium > available:
            raise HTTPException(
                400,
                f"Total honorarium (₹{total_honorarium:,.0f}) exceeds available BRS budget of ₹{available:,.0f} for Q{q_num} FY {fy}."
            )

    old = app.status
    app.status = BrsStatus.SUBMITTED
    _add_audit(db, app.id, "Submitted for Approval", old, BrsStatus.SUBMITTED, current_user.id)
    db.commit()
    return {"status": app.status}


@router.post("/{app_id}/approve")
def approve_application(app_id: int, remarks: str = "", background_tasks: BackgroundTasks = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Approve BRS — uses dynamic workflow to check authorization"""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.SUBMITTED:
        raise HTTPException(400, f"Expected Submitted, got {app.status}")

    # Dynamic workflow authorization
    step = get_step_for_status(db, "brs_approval", BrsStatus.SUBMITTED)
    if not step:
        raise HTTPException(400, "No approval workflow step configured. Contact admin.")
    if not can_user_approve_step(db, current_user, step, app.created_by_id):
        raise HTTPException(403, "You are not authorized to approve this BRS")
    next_status = step.approved_status or BrsStatus.DOCTOR_PENDING

    old = app.status
    app.status = next_status
    app.approved_by_id = current_user.id
    app.approved_at = datetime.now(timezone.utc)
    _add_audit(db, app.id, "Approved", old, next_status, current_user.id, remarks)

    # Generate login credentials for each doctor
    from app.core.config import settings

    doctor_credentials = []
    portal_url = f"{settings.FRONTEND_URL}/brs/doctor-login"

    for doc in app.doctors:
        login_id = f"brs_{app.brs_code}_{doc.id}".lower()
        password = _generate_password()
        doc.login_id = login_id
        doc.login_password = get_password_hash(password)
        doc.login_token = secrets.token_urlsafe(32)
        doc.doctor_status = "Pending"

        doctor_credentials.append({
            "doctor_name": doc.doctor_name,
            "email": doc.email,
            "mobile": doc.mobile,
            "speciality": doc.speciality,
            "login_id": login_id,
            "password": password,
        })

    # Send emails per territory assignment (instead of one email to on_field_execution_by)
    from app.core.email import send_brs_credentials_to_territory_manager

    # Build a map of doctor_id -> credentials for lookup
    doctor_cred_map = {cred["login_id"]: cred for cred in doctor_credentials}

    # Get territory assignments for this BRS
    territory_assignments = db.query(BrsTerritoryAssignment).filter(
        BrsTerritoryAssignment.brs_application_id == app.id
    ).all()

    db.commit()

    # Send email per territory assignment
    if background_tasks and territory_assignments:
        portal_url_email = f"{settings.FRONTEND_URL}/brs/doctor-login"
        for assignment in territory_assignments:
            if not assignment.assigned_user_id:
                continue
            tm_user = db.query(User).filter(User.id == assignment.assigned_user_id).first()
            if not tm_user or not tm_user.email:
                continue

            # Get doctors for this territory
            territory_doc_creds = []
            for doc in app.doctors:
                if not doc.hcp_doctor_id:
                    if assignment.territory_id is None:
                        cred = next((c for c in doctor_credentials if c["login_id"] == doc.login_id), None)
                        if cred:
                            territory_doc_creds.append(cred)
                    continue
                if assignment.territory_id is not None:
                    has_territory = db.query(HcpDoctorTerritory).filter(
                        HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id,
                        HcpDoctorTerritory.territory_id == assignment.territory_id,
                    ).first()
                    if has_territory:
                        cred = next((c for c in doctor_credentials if c["login_id"] == doc.login_id), None)
                        if cred:
                            territory_doc_creds.append(cred)
                else:
                    has_any = db.query(HcpDoctorTerritory).filter(
                        HcpDoctorTerritory.hcp_doctor_id == doc.hcp_doctor_id
                    ).first()
                    if not has_any:
                        cred = next((c for c in doctor_credentials if c["login_id"] == doc.login_id), None)
                        if cred:
                            territory_doc_creds.append(cred)

            if territory_doc_creds:
                background_tasks.add_task(
                    send_brs_credentials_to_territory_manager,
                    tm_email=tm_user.email,
                    tm_name=f"{tm_user.first_name or ''} {tm_user.last_name or ''}".strip(),
                    brs_code=app.brs_code,
                    brs_title=app.title,
                    survey_title=app.survey.title if app.survey else "BRS Survey",
                    doctor_credentials=territory_doc_creds,
                    portal_url=portal_url_email,
                )
                # Update assignment email status
                assignment.email_status = "sent"
                assignment.email_sent_at = datetime.now(timezone.utc)

        db.commit()
    elif background_tasks:
        # Fallback: if no territory assignments, send to on_field_execution_by (backward compat)
        tm_employee_id = app.on_field_execution_by
        tm_user = None
        if tm_employee_id:
            tm_user = db.query(User).filter(User.employee_id == tm_employee_id).first()
        if tm_user and tm_user.email:
            background_tasks.add_task(
                send_brs_credentials_to_territory_manager,
                tm_email=tm_user.email,
                tm_name=f"{tm_user.first_name or ''} {tm_user.last_name or ''}".strip(),
                brs_code=app.brs_code,
                brs_title=app.title,
                survey_title=app.survey.title if app.survey else "BRS Survey",
                doctor_credentials=doctor_credentials,
                portal_url=portal_url,
            )
    else:
        db.commit()

    return {"status": app.status, "message": "Approved. Doctor credentials generated and sent to Territory Manager."}


@router.post("/{app_id}/reject")
def reject_application(app_id: int, reason: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reject BRS — uses dynamic workflow to check authorization"""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.SUBMITTED:
        raise HTTPException(400, f"Expected Submitted, got {app.status}")

    # Dynamic workflow authorization
    step = get_step_for_status(db, "brs_approval", BrsStatus.SUBMITTED)
    if not step:
        raise HTTPException(400, "No approval workflow step configured. Contact admin.")
    if not can_user_approve_step(db, current_user, step, app.created_by_id):
        raise HTTPException(403, "You are not authorized to reject this BRS")

    old = app.status
    app.status = BrsStatus.DH_REJECTED
    app.rejection_reason = reason
    _add_audit(db, app.id, "Rejected", old, BrsStatus.DH_REJECTED, current_user.id, reason)
    db.commit()
    return {"status": app.status}


@router.post("/{app_id}/verify")
def verify_application(app_id: int, remarks: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Verify a completed BRS — uses dynamic workflow to check authorization"""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.COMPLETED:
        raise HTTPException(400, f"Only Completed BRS can be verified. Current status: {app.status}")

    # Dynamic workflow authorization — check for a step with pending_status="Completed"
    step = get_step_for_status(db, "brs_approval", "Completed")
    if not step:
        raise HTTPException(400, "No verification workflow step configured. Contact admin.")
    if not can_user_approve_step(db, current_user, step, app.created_by_id):
        raise HTTPException(403, "You are not authorized to verify this BRS")

    old = app.status
    app.status = BrsStatus.VERIFIED
    _add_audit(db, app.id, "Verified", old, BrsStatus.VERIFIED, current_user.id, remarks)
    db.commit()
    return {"status": app.status, "message": "BRS verified successfully"}


@router.get("/{app_id}/can-verify")
def can_verify_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check if current user can verify this BRS."""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")

    if app.status != BrsStatus.COMPLETED:
        return {"can_verify": False, "reason": "BRS is not in Completed status"}

    # Try to find a workflow step for "Completed" status
    step = get_step_for_status(db, "brs_approval", "Completed")
    if not step:
        return {"can_verify": False, "reason": "No verification workflow step configured. Contact admin."}

    can = can_user_approve_step(db, current_user, step, app.created_by_id)
    return {"can_verify": can, "reason": "" if can else "You are not authorized for this verification step"}


# ─────────────────────────────────────────────
#  Doctor Portal (public — doctor logs in)
# ─────────────────────────────────────────────

@router.post("/doctor-login")
@limiter.limit("10/minute")
def doctor_login(request: Request, data: dict, db: Session = Depends(get_db)):
    """Doctor logs in with credentials received via email"""
    from app.core.security import verify_password
    login_id = data.get("login_id", "")
    password = data.get("password", "")
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_id == login_id).first()
    if not doc or not doc.login_password:
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(password, doc.login_password):
        raise HTTPException(401, "Invalid credentials")
    return {"token": doc.login_token, "doctor_id": doc.id, "doctor_name": doc.doctor_name, "email": doc.email}


# In-memory OTP store (for production, use Redis or DB)
_otp_store = {}  # {token: {"otp": "123456", "expires": datetime, "verified": bool}}

import random


@router.post("/doctor-portal/{token}/send-otp")
@limiter.limit("5/minute")
def doctor_send_otp(request: Request, token: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Send OTP to doctor's email for verification"""
    from app.core.email import send_email

    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    if not doc.email:
        raise HTTPException(400, "No email address on file for this doctor. Please contact the administrator.")

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    _otp_store[token] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "verified": False,
    }

    # Send OTP email
    subject = "EMCatalyst — Your OTP for Survey Portal"
    body_html = f"""
<html><body style="font-family:'Poppins',Arial,sans-serif;color:#212529;background:#f8f9fa;margin:0;padding:24px;">
<div style="max-width:450px;margin:auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.10);">
  <div style="background:#ed1c24;padding:24px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:20px;font-weight:700;">EMCatalyst</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:11px;">Doctor Survey Portal</p>
  </div>
  <div style="padding:32px;text-align:center;">
    <p style="font-size:14px;color:#6c757d;margin:0 0 20px;">Dear Dr. {doc.doctor_name},</p>
    <p style="font-size:14px;color:#6c757d;margin:0 0 24px;">Your One-Time Password (OTP) for the BRS Survey Portal is:</p>
    <div style="background:#fff0f0;border:2px solid #ed1c24;border-radius:12px;padding:20px;margin:0 auto;display:inline-block;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ed1c24;">{otp}</span>
    </div>
    <p style="font-size:12px;color:#adb5bd;margin:20px 0 0;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
  </div>
  <div style="background:#f8f9fa;padding:12px;text-align:center;font-size:11px;color:#adb5bd;border-top:1px solid #e9ecef;">
    © Emcure Pharmaceuticals Ltd.
  </div>
</div>
</body></html>
"""
    body_text = f"Dear Dr. {doc.doctor_name},\n\nYour OTP: {otp}\n\nValid for 10 minutes."
    background_tasks.add_task(send_email, doc.email, subject, body_html, body_text)

    # Mask email for display
    email = doc.email
    parts = email.split("@")
    masked = parts[0][:2] + "***" + "@" + parts[1] if len(parts) == 2 else "***"

    return {"ok": True, "message": f"OTP sent to {masked}"}


@router.post("/doctor-portal/{token}/verify-otp")
@limiter.limit("10/minute")
def doctor_verify_otp(request: Request, token: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Verify the OTP entered by the doctor"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")

    otp_entry = _otp_store.get(token)
    if not otp_entry:
        raise HTTPException(400, "No OTP generated. Please request a new OTP.")

    if datetime.now(timezone.utc) > otp_entry["expires"]:
        del _otp_store[token]
        raise HTTPException(400, "OTP has expired. Please request a new one.")

    entered_otp = str(data.get("otp", "")).strip()
    if entered_otp != otp_entry["otp"]:
        raise HTTPException(400, "Invalid OTP. Please try again.")

    # Mark as verified
    _otp_store[token]["verified"] = True

    # Deduct BRS budget on first OTP verification only (check if not already deducted for this doctor)
    if not getattr(doc, '_budget_deducted', False):
        # Use a simple check: if doctor_status is still "Pending", budget hasn't been deducted yet
        if doc.doctor_status == "Pending":
            _deduct_brs_budget(db, doc)
    db.commit()

    return {"ok": True, "message": "OTP verified successfully"}


@router.get("/doctor-portal/{token}/otp-status")
def doctor_otp_status(token: str):
    """Check if OTP has been verified for this session"""
    otp_entry = _otp_store.get(token)
    if otp_entry and otp_entry.get("verified"):
        return {"verified": True}
    return {"verified": False}


@router.get("/doctor-portal/{token}")
def doctor_portal_get(token: str, db: Session = Depends(get_db)):
    """Doctor accesses their portal via token. Clears OTP verification so doctor must re-verify each session."""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")

    # Clear OTP verification on page load — doctor must verify each time
    if token in _otp_store:
        _otp_store[token]["verified"] = False
    app = doc.brs_application
    survey = app.survey
    return {
        "doctor": {
            "id": doc.id, "doctor_name": doc.doctor_name,
            "name_as_per_pan": doc.name_as_per_pan, "pan_number": doc.pan_number,
            "email": doc.email, "mobile": doc.mobile, "speciality": doc.speciality,
            "honorarium_amount": float(doc.honorarium_amount or 0),
            "doctor_status": doc.doctor_status,
            "agreement_signed": doc.agreement_signed_at is not None,
            "survey_completed": doc.survey_completed_at is not None,
        },
        "brs": {"id": app.id, "brs_code": app.brs_code, "title": app.title},
        "survey": {
            "id": survey.id, "title": survey.title,
            "agreement_template": survey.agreement_template or "",
            "requires_agreement": survey.requires_agreement_download,
            "questions": [
                {"id": q.id, "order_no": q.order_no, "question_text": q.question_text,
                 "question_type": q.question_type or "free_text",
                 "options": q.options or [],
                 "is_required": q.is_required}
                for q in survey.questions
            ] if survey else []
        } if survey else None,
    }


@router.post("/doctor-portal/{token}/update-details")
def doctor_update_details(token: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Doctor updates their personal details"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    for field in ["name_as_per_pan", "pan_number", "email", "mobile", "speciality"]:
        if field in data:
            setattr(doc, field, data[field])
    doc.details_updated_at = datetime.now(timezone.utc)
    doc.doctor_status = "Details Updated"
    db.commit()
    return {"ok": True}


@router.post("/doctor-portal/{token}/sign-agreement")
def doctor_sign_agreement(token: str, signature: str = "", db: Session = Depends(get_db)):
    """Doctor signs the agreement"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    doc.agreement_signed_at = datetime.now(timezone.utc)
    doc.agreement_signature = signature
    doc.doctor_status = "Agreement Signed"
    db.commit()
    return {"ok": True}


@router.post("/doctor-portal/{token}/submit-survey")
def doctor_submit_survey(token: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Doctor submits the survey — must have signed agreement first"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    if not doc.agreement_signed_at:
        raise HTTPException(400, "Agreement must be signed before submitting survey")

    responses = data.get("responses", {})
    # Validate response size (max 100KB serialized)
    import json
    if len(json.dumps(responses)) > 100 * 1024:
        raise HTTPException(400, "Survey responses too large")

    doc.survey_responses = responses
    doc.survey_completed_at = datetime.now(timezone.utc)
    doc.doctor_status = "Survey Completed"

    # Check if all doctors in this BRS have completed
    app = doc.brs_application
    all_done = all(d.survey_completed_at is not None for d in app.doctors)
    if all_done:
        app.status = BrsStatus.COMPLETED
        _add_audit(db, app.id, "All Doctors Completed", BrsStatus.DOCTOR_PENDING, BrsStatus.COMPLETED, None, "All doctors submitted surveys")

    db.commit()
    return {"ok": True, "brs_completed": all_done}


@router.post("/doctor-portal/{token}/upload-document")
async def doctor_upload_document(
    token: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Doctor uploads a document (PAN, Cheque, Letterhead, Others)"""
    from app.models.brs import BrsDoctorDocument
    import os, uuid, shutil

    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")

    # Validate file type
    allowed_types = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only PNG, JPEG, or PDF files are allowed")

    # Validate document_type
    valid_doc_types = ['pan_copy', 'cancelled_cheque', 'letterhead', 'others']
    if document_type not in valid_doc_types:
        raise HTTPException(400, f"Invalid document type. Must be one of: {valid_doc_types}")

    # Validate file size (max 5MB)
    MAX_SIZE_BYTES = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(400, "File must be under 5MB")

    # Save file
    upload_dir = f"uploads/brs/doctors/{doc.id}"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{document_type}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Save record
    doc_record = BrsDoctorDocument(
        brs_doctor_id=doc.id,
        document_type=document_type,
        document_name=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)
    return {"id": doc_record.id, "document_type": document_type, "document_name": file.filename}


@router.get("/doctor-portal/{token}/documents")
def doctor_list_documents(token: str, db: Session = Depends(get_db)):
    """List documents uploaded by doctor"""
    from app.models.brs import BrsDoctorDocument
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    return [
        {"id": d.id, "document_type": d.document_type, "document_name": d.document_name, "file_path": d.file_path}
        for d in doc.documents
    ]


@router.delete("/doctor-portal/{token}/documents/{doc_id}")
def doctor_delete_document(token: str, doc_id: int, db: Session = Depends(get_db)):
    """Delete an uploaded document"""
    from app.models.brs import BrsDoctorDocument
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
    doc_record = db.query(BrsDoctorDocument).filter(BrsDoctorDocument.id == doc_id, BrsDoctorDocument.brs_doctor_id == doc.id).first()
    if not doc_record:
        raise HTTPException(404, "Document not found")
    db.delete(doc_record)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
#  Dashboard
# ─────────────────────────────────────────────

@router.get("/{app_id}/documents")
def list_application_documents(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List documents uploaded by the initiator for a completed BRS."""
    from app.models.brs import BrsApplicationDocument
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    docs = db.query(BrsApplicationDocument).filter(BrsApplicationDocument.brs_application_id == app_id).order_by(BrsApplicationDocument.uploaded_at).all()
    return [
        {
            "id": d.id,
            "document_name": d.document_name,
            "file_path": d.file_path,
            "mime_type": d.mime_type,
            "uploaded_by": f"{d.uploaded_by.first_name} {d.uploaded_by.last_name}" if d.uploaded_by else None,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@router.post("/{app_id}/documents")
async def upload_application_document(
    app_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initiator uploads a document to a completed BRS."""
    from app.models.brs import BrsApplicationDocument
    import os, uuid

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.status != BrsStatus.COMPLETED:
        raise HTTPException(400, "Documents can only be uploaded after BRS is completed")
    if app.created_by_id != current_user.id and not current_user.is_superuser and current_user.role != "Administrator":
        raise HTTPException(403, "Only the initiator can upload documents")

    # Validate file size (max 10MB)
    MAX_SIZE_BYTES = 10 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(400, "File must be under 10MB")

    # Save file
    upload_dir = f"uploads/brs/application_docs/{app_id}"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    doc_record = BrsApplicationDocument(
        brs_application_id=app_id,
        document_name=file.filename or filename,
        file_path=file_path,
        mime_type=file.content_type,
        uploaded_by_id=current_user.id,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)
    return {"id": doc_record.id, "document_name": doc_record.document_name, "file_path": doc_record.file_path}


@router.delete("/{app_id}/documents/{doc_id}")
def delete_application_document(app_id: int, doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Initiator deletes an uploaded document."""
    from app.models.brs import BrsApplicationDocument
    import os

    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS not found")
    if app.created_by_id != current_user.id and not current_user.is_superuser and current_user.role != "Administrator":
        raise HTTPException(403, "Only the initiator can delete documents")

    doc_record = db.query(BrsApplicationDocument).filter(
        BrsApplicationDocument.id == doc_id,
        BrsApplicationDocument.brs_application_id == app_id
    ).first()
    if not doc_record:
        raise HTTPException(404, "Document not found")

    # Delete file from disk
    if doc_record.file_path and os.path.exists(doc_record.file_path):
        os.remove(doc_record.file_path)

    db.delete(doc_record)
    db.commit()
    return {"ok": True}

@router.get("/doctors/{doctor_id}/agreement")
def get_doctor_agreement(
    doctor_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Get the signed agreement signature for a doctor — requires auth or doctor's own token"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(404, "Doctor not found")
    # Allow either the doctor's own token OR an authenticated internal user
    if not (token and token == doc.login_token) and not current_user:
        raise HTTPException(403, "Unauthorized")
    if not doc.agreement_signature:
        raise HTTPException(404, "Agreement not signed yet")
    return {
        "doctor_name": doc.doctor_name,
        "name_as_per_pan": doc.name_as_per_pan,
        "pan_number": doc.pan_number,
        "email": doc.email,
        "honorarium_amount": float(doc.honorarium_amount or 0),
        "agreement_signed_at": doc.agreement_signed_at.isoformat() if doc.agreement_signed_at else None,
        "signature": doc.agreement_signature,
    }
