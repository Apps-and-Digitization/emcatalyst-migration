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
from app.models.user import User, UserRoleAssignment, Division
from app.models.brs import (
    BrsApplication, BrsStatus, BrsSurvey, BrsSurveyQuestion,
    BrsQuestionType, BrsAuditTrail, BrsDoctor
)
from app.models.master import HcpDoctor
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
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    survey = BrsSurvey(
        title=title, description=description,
        total_honorarium_amount=total_honorarium_amount,
        division_id=division_id,
        agreement_template=agreement_template,
        requires_agreement_download=requires_agreement_download,
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
    """Upload Medical Team Approval or Ethical Team Approval document for a survey."""
    import os, uuid, shutil

    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")

    if document_type not in ("medical_approval", "ethical_approval"):
        raise HTTPException(400, "document_type must be 'medical_approval' or 'ethical_approval'")

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
    else:
        s.ethical_approval_file = file_path

    # Auto-approve if both documents are uploaded
    if s.medical_approval_file and s.ethical_approval_file:
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

    if document_type not in ("medical_approval", "ethical_approval"):
        raise HTTPException(400, "document_type must be 'medical_approval' or 'ethical_approval'")

    # Delete the file
    file_path = s.medical_approval_file if document_type == "medical_approval" else s.ethical_approval_file
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Clear the field
    if document_type == "medical_approval":
        s.medical_approval_file = None
    else:
        s.ethical_approval_file = None

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
        # Fallback: check old hardcoded role
        can = _has_role(current_user, "DivisionHead") or current_user.is_superuser
        return {"can_approve": can, "reason": "" if can else "No workflow step configured and user is not Division Head"}

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
    if step:
        if not can_user_approve_step(db, current_user, step, app.created_by_id):
            raise HTTPException(403, "You are not authorized to approve this BRS")
        next_status = step.approved_status or BrsStatus.DOCTOR_PENDING
    else:
        # Fallback to hardcoded check
        if not _has_role(current_user, "DivisionHead"):
            raise HTTPException(403, "Only Division Head can approve BRS")
        next_status = BrsStatus.DOCTOR_PENDING

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

    # Send ONE email to the Territory Manager (on_field_execution_by) with all doctor credentials
    from app.core.email import send_brs_credentials_to_territory_manager

    tm_employee_id = app.on_field_execution_by
    tm_user = None
    if tm_employee_id:
        tm_user = db.query(User).filter(User.employee_id == tm_employee_id).first()

    db.commit()

    # Send email in background (after commit) so it doesn't block the response
    if tm_user and tm_user.email and background_tasks:
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
    if step:
        if not can_user_approve_step(db, current_user, step, app.created_by_id):
            raise HTTPException(403, "You are not authorized to reject this BRS")
    else:
        if not _has_role(current_user, "DivisionHead"):
            raise HTTPException(403, "Only Division Head can reject BRS")

    old = app.status
    app.status = BrsStatus.DH_REJECTED
    app.rejection_reason = reason
    _add_audit(db, app.id, "Rejected", old, BrsStatus.DH_REJECTED, current_user.id, reason)
    db.commit()
    return {"status": app.status}


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
    """Doctor accesses their portal via token"""
    doc = db.query(BrsDoctor).filter(BrsDoctor.login_token == token).first()
    if not doc:
        raise HTTPException(404, "Invalid token")
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

    return {
        "total": total, "draft": draft, "submitted": submitted,
        "approved": approved, "doctor_pending": doctor_pending, "completed": completed,
    }
