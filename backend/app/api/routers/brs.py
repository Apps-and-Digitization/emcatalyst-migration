from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
import random
import string
import secrets
import os
import base64

from app.db.base import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.models.brs import (
    BrsApplication, BrsStatus, BrsSurvey, BrsSurveyQuestion,
    BrsQuestionType, BrsAuditTrail, BrsOtp, BrsBulkRequest, DoctorPortalSession
)
from app.models.master import HcpDoctor
from app.core.email import send_brs_survey_link, send_vendor_creation_notification

router = APIRouter(prefix="/brs", tags=["BRS"])

UPLOADS_DIR = "uploads/brs"
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(f"{UPLOADS_DIR}/signatures", exist_ok=True)
os.makedirs(f"{UPLOADS_DIR}/pan", exist_ok=True)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _generate_brs_code(db: Session) -> str:
    from datetime import date
    prefix = f"BRS{date.today().strftime('%Y%m')}"
    last = (db.query(BrsApplication)
            .filter(BrsApplication.brs_code.like(f"{prefix}%"))
            .order_by(desc(BrsApplication.brs_code))
            .first())
    seq = 1
    if last and last.brs_code:
        try:
            seq = int(last.brs_code[len(prefix):]) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _add_audit(db: Session, app_id: int, action: str, from_s: str, to_s: str,
               user_id: Optional[int] = None, remarks: str = ""):
    db.add(BrsAuditTrail(
        application_id=app_id, action=action,
        from_status=from_s, to_status=to_s,
        performed_by_id=user_id, remarks=remarks
    ))


def _app_or_404(db: Session, app_id: int) -> BrsApplication:
    app = db.query(BrsApplication).filter(BrsApplication.id == app_id).first()
    if not app:
        raise HTTPException(404, "BRS application not found")
    return app


def _get_doctor_display(app: BrsApplication) -> dict:
    if app.hcp_doctor:
        d = app.hcp_doctor
        return {
            "name": d.full_name or f"{d.first_name or ''} {d.last_name or ''}".strip(),
            "email": d.email,
            "phone": d.mobile_number,
            "speciality": d.qualification or d.doctor_type,
            "city": d.city
        }
    return {
        "name": app.new_doctor_name, "email": app.new_doctor_email,
        "phone": app.new_doctor_phone, "speciality": app.new_doctor_speciality,
        "city": app.new_doctor_city
    }


# ─────────────────────────────────────────────
#  Survey Builder endpoints (admin)
# ─────────────────────────────────────────────

@router.get("/surveys")
def list_surveys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    surveys = db.query(BrsSurvey).order_by(desc(BrsSurvey.created_at)).all()
    return [
        {
            "id": s.id, "title": s.title, "description": s.description,
            "honorarium_upper_limit": float(s.honorarium_upper_limit or 0),
            "is_active": s.is_active, "requires_agreement_download": s.requires_agreement_download,
            "question_count": len(s.questions),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in surveys
    ]


@router.post("/surveys")
def create_survey(
    title: str, description: str = "", honorarium_upper_limit: float = 0,
    agreement_template: str = "", requires_agreement_download: bool = True,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    survey = BrsSurvey(
        title=title, description=description,
        honorarium_upper_limit=honorarium_upper_limit,
        agreement_template=agreement_template,
        requires_agreement_download=requires_agreement_download,
        created_by_id=current_user.id
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"id": survey.id, "title": survey.title}


@router.get("/surveys/{survey_id}")
def get_survey(survey_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    return {
        "id": s.id, "title": s.title, "description": s.description,
        "honorarium_upper_limit": float(s.honorarium_upper_limit or 0),
        "is_active": s.is_active,
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
    honorarium_upper_limit: float = None, agreement_template: str = None,
    requires_agreement_download: bool = None, is_active: bool = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    if title is not None:
        s.title = title
    if description is not None:
        s.description = description
    if honorarium_upper_limit is not None:
        s.honorarium_upper_limit = honorarium_upper_limit
    if agreement_template is not None:
        s.agreement_template = agreement_template
    if requires_agreement_download is not None:
        s.requires_agreement_download = requires_agreement_download
    if is_active is not None:
        s.is_active = is_active
    s.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/surveys/{survey_id}/questions")
def add_question(
    survey_id: int,
    question_text: str,
    question_type: BrsQuestionType = BrsQuestionType.FREE_TEXT,
    options: List[str] = None,
    is_required: bool = True,
    min_duration_seconds: int = 0,
    video_url: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = db.query(BrsSurvey).filter(BrsSurvey.id == survey_id).first()
    if not s:
        raise HTTPException(404, "Survey not found")
    max_order = db.query(func.max(BrsSurveyQuestion.order_no)).filter(
        BrsSurveyQuestion.survey_id == survey_id).scalar() or 0
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


@router.put("/surveys/{survey_id}/questions/{question_id}")
def update_question(
    survey_id: int, question_id: int,
    question_text: str = None,
    question_type: BrsQuestionType = None,
    options: List[str] = None,
    is_required: bool = None,
    min_duration_seconds: int = None,
    video_url: str = None,
    order_no: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(BrsSurveyQuestion).filter(
        BrsSurveyQuestion.id == question_id,
        BrsSurveyQuestion.survey_id == survey_id
    ).first()
    if not q:
        raise HTTPException(404, "Question not found")
    if question_text is not None:
        q.question_text = question_text
    if question_type is not None:
        q.question_type = question_type
    if options is not None:
        q.options = options
    if is_required is not None:
        q.is_required = is_required
    if min_duration_seconds is not None:
        q.min_duration_seconds = min_duration_seconds
    if video_url is not None:
        q.video_url = video_url
    if order_no is not None:
        q.order_no = order_no
    db.commit()
    return {"ok": True}


@router.delete("/surveys/{survey_id}/questions/{question_id}")
def delete_question(
    survey_id: int, question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(BrsSurveyQuestion).filter(
        BrsSurveyQuestion.id == question_id,
        BrsSurveyQuestion.survey_id == survey_id
    ).first()
    if not q:
        raise HTTPException(404, "Question not found")
    db.delete(q)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
#  BRS Applications
# ─────────────────────────────────────────────

@router.get("/dashboard")
def brs_dashboard(db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    total = db.query(func.count(BrsApplication.id)).scalar() or 0
    in_progress = db.query(func.count(BrsApplication.id)).filter(
        BrsApplication.status.notin_([BrsStatus.DRAFT, BrsStatus.PAID,
                                       BrsStatus.POSTED, BrsStatus.SURVEY_COMPLETED])
    ).scalar() or 0
    completed = db.query(func.count(BrsApplication.id)).filter(
        BrsApplication.status == BrsStatus.PAID
    ).scalar() or 0
    pending_sign = db.query(func.count(BrsApplication.id)).filter(
        BrsApplication.status == BrsStatus.PENDING_SIGN
    ).scalar() or 0
    agreements_sent = db.query(func.count(BrsApplication.id)).filter(
        BrsApplication.agreement_sent_at.isnot(None)
    ).scalar() or 0
    survey_completed = db.query(func.count(BrsApplication.id)).filter(
        BrsApplication.status.in_([
            BrsStatus.SURVEY_COMPLETED, BrsStatus.PENDING_COORD_VERIFICATION,
            BrsStatus.PENDING_VENDOR_CREATION, BrsStatus.PENDING_FINANCE,
            BrsStatus.POSTED, BrsStatus.PAID
        ])
    ).scalar() or 0
    return {
        "total": total,
        "in_progress": in_progress,
        "completed": completed,
        "pending_sign": pending_sign,
        "agreements_sent": agreements_sent,
        "survey_completed": survey_completed
    }


@router.get("/")
def list_applications(
    status: Optional[str] = None,
    division_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(BrsApplication)
    if status:
        q = q.filter(BrsApplication.status == status)
    if division_id:
        q = q.filter(BrsApplication.division_id == division_id)
    if search:
        q = q.filter(BrsApplication.survey_title.ilike(f"%{search}%") |
                     BrsApplication.brs_code.ilike(f"%{search}%"))
    total = q.count()
    apps = q.order_by(desc(BrsApplication.created_at)).offset(skip).limit(limit).all()

    result = []
    for a in apps:
        doc = _get_doctor_display(a)
        result.append({
            "id": a.id, "brs_code": a.brs_code,
            "survey_title": a.survey_title,
            "therapeutic_area": a.therapeutic_area,
            "brand": a.brand,
            "honorarium_amount": float(a.honorarium_amount or 0),
            "status": a.status,
            "mode": a.mode,
            "doctor_name": doc["name"],
            "doctor_email": doc["email"],
            "division_id": a.division_id,
            "is_new_doctor": a.is_new_doctor,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "initiator_name": f"{a.initiator.first_name} {a.initiator.last_name}" if a.initiator else None,
        })
    return {"total": total, "items": result}


@router.post("/")
def create_application(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.ADMINISTRATOR:
        raise HTTPException(403, "System administrators cannot initiate BRS applications. Please use a field user account.")
    app = BrsApplication(
        brs_code=_generate_brs_code(db),
        survey_title=data["survey_title"],
        therapeutic_area=data.get("therapeutic_area"),
        brand=data.get("brand"),
        topic=data.get("topic"),
        mode=data.get("mode", "Online"),
        survey_duration_days=data.get("survey_duration_days", 7),
        honorarium_amount=data.get("honorarium_amount"),
        division_id=data.get("division_id"),
        cost_center=data.get("cost_center"),
        company_code=data.get("company_code"),
        remarks=data.get("remarks"),
        is_new_doctor=data.get("is_new_doctor", False),
        hcp_doctor_id=data.get("hcp_doctor_id"),
        new_doctor_name=data.get("new_doctor_name"),
        new_doctor_email=data.get("new_doctor_email"),
        new_doctor_phone=data.get("new_doctor_phone"),
        new_doctor_speciality=data.get("new_doctor_speciality"),
        new_doctor_city=data.get("new_doctor_city"),
        survey_id=data.get("survey_id"),
        bulk_request_id=data.get("bulk_request_id"),
        initiator_id=current_user.id,
        status=BrsStatus.DRAFT
    )
    db.add(app)
    db.flush()
    _add_audit(db, app.id, "Created", "", BrsStatus.DRAFT, current_user.id, "Application created")
    db.commit()
    db.refresh(app)
    return {"id": app.id, "brs_code": app.brs_code}


@router.get("/{app_id}")
def get_application(app_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    doc = _get_doctor_display(a)
    survey_data = None
    if a.survey:
        s = a.survey
        survey_data = {
            "id": s.id, "title": s.title,
            "agreement_template": s.agreement_template or "",
            "questions": [
                {
                    "id": q.id, "order_no": q.order_no,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": q.options or [],
                    "is_required": q.is_required,
                    "min_duration_seconds": q.min_duration_seconds,
                    "video_url": q.video_url
                }
                for q in s.questions
            ]
        }
    return {
        "id": a.id, "brs_code": a.brs_code,
        "survey_title": a.survey_title, "therapeutic_area": a.therapeutic_area,
        "brand": a.brand, "topic": a.topic, "mode": a.mode,
        "survey_duration_days": a.survey_duration_days or 7,
        "survey_deadline_at": a.survey_deadline_at.isoformat() if a.survey_deadline_at else None,
        "honorarium_amount": float(a.honorarium_amount or 0),
        "division_id": a.division_id, "cost_center": a.cost_center,
        "company_code": a.company_code, "remarks": a.remarks,
        "status": a.status,
        "hcp_doctor_id": a.hcp_doctor_id,
        "is_new_doctor": a.is_new_doctor,
        "pan_number": a.pan_number,
        "bank_name": a.bank_name,
        "bank_account_no": a.bank_account_no,
        "ifsc_code": a.ifsc_code,
        "doctor": doc,
        "survey": survey_data,
        "survey_id": a.survey_id,
        "survey_responses": a.survey_responses,
        "survey_link_sent_at": a.survey_link_sent_at.isoformat() if a.survey_link_sent_at else None,
        "survey_started_at": a.survey_started_at.isoformat() if a.survey_started_at else None,
        "survey_completed_at": a.survey_completed_at.isoformat() if a.survey_completed_at else None,
        "agreement_signed_at": a.agreement_signed_at.isoformat() if a.agreement_signed_at else None,
        "signature_otp_verified": a.signature_otp_verified,
        "has_signature": bool(a.signature_image_path),
        "vendor_id": a.vendor_id,
        "vendor_creation_notified_at": a.vendor_creation_notified_at.isoformat() if a.vendor_creation_notified_at else None,
        "rejection_reason": a.rejection_reason,
        "bulk_request_id": a.bulk_request_id,
        "agreement_text": _default_agreement(a),
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "initiator": {
            "id": a.initiator.id,
            "name": f"{a.initiator.first_name} {a.initiator.last_name}",
            "designation": a.initiator.designation_title,
            "employee_id": a.initiator.employee_id,
        } if a.initiator else None,
        "l1_approver": {
            "id": a.l1_approver.id,
            "name": f"{a.l1_approver.first_name} {a.l1_approver.last_name or ''}".strip(),
            "designation": a.l1_approver.designation_title,
            "employee_id": a.l1_approver.employee_id,
            "approved_at": a.l1_approved_at.isoformat() if a.l1_approved_at else None,
        } if a.l1_approver else None,
        "l2_approver": {
            "id": a.l2_approver.id,
            "name": f"{a.l2_approver.first_name} {a.l2_approver.last_name or ''}".strip(),
            "designation": a.l2_approver.designation_title,
            "employee_id": a.l2_approver.employee_id,
            "approved_at": a.l2_approved_at.isoformat() if a.l2_approved_at else None,
        } if a.l2_approver else None,
        "audit_trail": [
            {
                "action": t.action, "from_status": t.from_status,
                "to_status": t.to_status,
                "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else "System",
                "remarks": t.remarks,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in a.audit_trail
        ]
    }


@router.put("/{app_id}")
def update_application(app_id: int, data: dict,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status not in [BrsStatus.DRAFT]:
        raise HTTPException(400, "Can only edit in Draft status")
    allowed = ["survey_title", "therapeutic_area", "brand", "topic", "mode",
               "survey_duration_minutes", "honorarium_amount", "division_id",
               "cost_center", "company_code", "remarks", "hcp_doctor_id",
               "is_new_doctor", "new_doctor_name", "new_doctor_email",
               "new_doctor_phone", "new_doctor_speciality", "new_doctor_city",
               "pan_number", "bank_name", "bank_account_no", "ifsc_code", "survey_id"]
    for k, v in data.items():
        if k in allowed:
            setattr(a, k, v)
    a.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
#  Workflow actions
# ─────────────────────────────────────────────

@router.post("/{app_id}/submit")
def submit_application(app_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.DRAFT:
        raise HTTPException(400, "Application not in Draft")
    old = a.status

    # Auto-assign L1 and L2 from the initiator's manager chain
    initiator = db.query(User).filter(User.id == current_user.id).first()
    l1 = db.query(User).filter(User.id == initiator.manager_id).first() if initiator and initiator.manager_id else None
    l2 = db.query(User).filter(User.id == l1.manager_id).first() if l1 and l1.manager_id else None

    if l1:
        a.l1_approver_id = l1.id
    if l2:
        a.l2_approver_id = l2.id

    a.status = BrsStatus.PENDING_L1
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Submitted for L1 Approval", old, BrsStatus.PENDING_L1, current_user.id,
               f"L1: {l1.first_name + ' ' + (l1.last_name or '') if l1 else 'unassigned'}, "
               f"L2: {l2.first_name + ' ' + (l2.last_name or '') if l2 else 'unassigned'}")
    db.commit()
    return {
        "status": a.status,
        "l1_approver": f"{l1.first_name} {l1.last_name or ''} ({l1.designation_title or ''})".strip() if l1 else None,
        "l2_approver": f"{l2.first_name} {l2.last_name or ''} ({l2.designation_title or ''})".strip() if l2 else None,
    }


@router.post("/{app_id}/approve-l1")
def approve_l1(app_id: int, remarks: str = "", db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_L1:
        raise HTTPException(400, f"Expected Pending L1, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_L2
    a.l1_approver_id = current_user.id
    a.l1_approved_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "L1 Approved", old, BrsStatus.PENDING_L2, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/approve-l2")
def approve_l2(app_id: int, remarks: str = "", db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_L2:
        raise HTTPException(400, f"Expected Pending L2, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_COMPLIANCE
    a.l2_approver_id = current_user.id
    a.l2_approved_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "L2 Approved", old, BrsStatus.PENDING_COMPLIANCE, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/approve-compliance")
def approve_compliance(app_id: int, remarks: str = "", db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_COMPLIANCE:
        raise HTTPException(400, f"Expected Pending Compliance, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_HCP_FORM
    a.compliance_approver_id = current_user.id
    a.compliance_approved_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Compliance Approved", old, BrsStatus.PENDING_HCP_FORM, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/reject")
def reject_application(app_id: int, reason: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status in [BrsStatus.PAID, BrsStatus.POSTED]:
        raise HTTPException(400, "Cannot reject a posted/paid application")
    old = a.status
    a.status = BrsStatus.DRAFT
    a.rejection_reason = reason
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Rejected / Returned to Draft", old, BrsStatus.DRAFT, current_user.id, reason)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/send-survey-link")
def send_survey_link(app_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_HCP_FORM:
        raise HTTPException(400, "Application must be in Pending HCP Form status")

    # Generate token
    token = secrets.token_urlsafe(32)
    a.survey_token = token
    a.survey_link_sent_at = datetime.utcnow()
    a.agreement_sent_at = datetime.utcnow()
    a.survey_deadline_at = datetime.utcnow() + timedelta(days=a.survey_duration_days or 7)
    a.updated_at = datetime.utcnow()

    doc = _get_doctor_display(a)
    doctor_email = doc["email"]
    doctor_name = doc["name"] or "Doctor"

    # Send email
    survey_link = f"http://localhost:5173/brs/survey/{token}"
    send_brs_survey_link(
        doctor_email=doctor_email or "no-email@example.com",
        doctor_name=doctor_name,
        survey_title=a.survey_title,
        survey_link=survey_link,
        honorarium_amount=float(a.honorarium_amount or 0)
    )

    _add_audit(db, a.id, "Survey Link Sent to Doctor", a.status, a.status, current_user.id,
               f"Link sent to {doctor_email}")
    db.commit()
    return {"ok": True, "survey_link": survey_link, "token": token}


@router.post("/{app_id}/verify-coord")
def verify_coord(app_id: int, remarks: str = "", db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_COORD_VERIFICATION:
        raise HTTPException(400, f"Expected Pending Coord. Verification, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_VENDOR_CREATION
    a.coord_verified_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Coordinator Verified", old, BrsStatus.PENDING_VENDOR_CREATION, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/trigger-vendor-creation")
def trigger_vendor_creation(app_id: int, db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_VENDOR_CREATION:
        raise HTTPException(400, "Application must be in Pending Vendor Creation status")
    doc = _get_doctor_display(a)
    send_vendor_creation_notification(
        application_code=a.brs_code,
        doctor_name=doc["name"] or "",
        pan=a.pan_number or "",
        bank_name=a.bank_name or "",
        account_no=a.bank_account_no or "",
        ifsc=a.ifsc_code or ""
    )
    a.vendor_creation_notified_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Vendor Creation Notification Sent", a.status, a.status, current_user.id)
    db.commit()
    return {"ok": True}


@router.post("/{app_id}/mark-vendor-created")
def mark_vendor_created(app_id: int, vendor_id: Optional[int] = None,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_VENDOR_CREATION:
        raise HTTPException(400, f"Expected Pending Vendor Creation, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_FINANCE
    if vendor_id:
        a.vendor_id = vendor_id
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Vendor Created / Linked", old, BrsStatus.PENDING_FINANCE, current_user.id)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/post-finance")
def post_finance(app_id: int, remarks: str = "", db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.PENDING_FINANCE:
        raise HTTPException(400, f"Expected Pending Finance, got {a.status}")
    old = a.status
    a.status = BrsStatus.POSTED
    a.finance_posted_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Posted to Finance", old, BrsStatus.POSTED, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


@router.post("/{app_id}/mark-paid")
def mark_paid(app_id: int, remarks: str = "", db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.POSTED:
        raise HTTPException(400, f"Expected Posted, got {a.status}")
    old = a.status
    a.status = BrsStatus.PAID
    a.paid_at = datetime.utcnow()
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Marked as Paid", old, BrsStatus.PAID, current_user.id, remarks)
    db.commit()
    return {"status": a.status}


# ─────────────────────────────────────────────
#  PAN document upload
# ─────────────────────────────────────────────

@router.post("/{app_id}/upload-pan")
async def upload_pan(app_id: int, file: UploadFile = File(...),
                     db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{UPLOADS_DIR}/pan/brs_{app_id}_pan{ext}"
    content = await file.read()
    with open(filename, "wb") as f:
        f.write(content)
    a.pan_document_path = filename
    a.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "path": filename}


# ─────────────────────────────────────────────
#  Public Doctor Portal (no auth required)
# ─────────────────────────────────────────────

@router.get("/portal/{token}")
def portal_get(token: str, db: Session = Depends(get_db)):
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid or expired survey link")

    allowed_statuses = [
        BrsStatus.PENDING_HCP_FORM, BrsStatus.PENDING_SURVEY,
        BrsStatus.PENDING_SIGN, BrsStatus.SURVEY_COMPLETED
    ]
    if a.status not in allowed_statuses:
        raise HTTPException(400, "Survey is not available at this time")

    doc = _get_doctor_display(a)
    survey_data = None
    if a.survey:
        s = a.survey
        survey_data = {
            "id": s.id, "title": s.title,
            "agreement_template": s.agreement_template or _default_agreement(a),
            "questions": [
                {
                    "id": q.id, "order_no": q.order_no,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": q.options or [],
                    "is_required": q.is_required,
                    "min_duration_seconds": q.min_duration_seconds,
                    "video_url": q.video_url
                }
                for q in s.questions
            ]
        }
    else:
        survey_data = {
            "id": None, "title": a.survey_title,
            "agreement_template": _default_agreement(a),
            "questions": []
        }

    return {
        "status": a.status,
        "brs_code": a.brs_code,
        "survey_title": a.survey_title,
        "honorarium_amount": float(a.honorarium_amount or 0),
        "mode": a.mode,
        "survey_duration_days": a.survey_duration_days or 7,
        "survey_deadline_at": a.survey_deadline_at.isoformat() if a.survey_deadline_at else None,
        "doctor": doc,
        "pan_number": a.hcp_doctor.pan_number if a.hcp_doctor else a.pan_number,
        "bank_name": a.hcp_doctor.bank_name if a.hcp_doctor else a.bank_name,
        "bank_account_no": a.hcp_doctor.account_number if a.hcp_doctor else a.bank_account_no,
        "ifsc_code": a.hcp_doctor.ifsc_code if a.hcp_doctor else a.ifsc_code,
        "survey": survey_data,
        "survey_responses": a.survey_responses,
        "agreement_signed": bool(a.agreement_signed_at),
        "has_signature": bool(a.signature_image_path),
    }


@router.post("/portal/{token}/update-details")
def portal_update_details(token: str, data: dict, db: Session = Depends(get_db)):
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid link")
    if a.status != BrsStatus.PENDING_HCP_FORM:
        raise HTTPException(400, "Details already submitted")
    pan = data.get("pan_number", "")
    bank_name = data.get("bank_name", "")
    bank_account_no = data.get("bank_account_no", "")
    ifsc_code = data.get("ifsc_code", "")

    # Save KYC to HcpDoctor profile for future use
    if a.hcp_doctor_id and a.hcp_doctor:
        d = a.hcp_doctor
        if pan: d.pan_number = pan
        if bank_name: d.bank_name = bank_name
        if bank_account_no: d.account_number = bank_account_no
        if ifsc_code: d.ifsc_code = ifsc_code
    else:
        # New doctor — store on application
        for k, v in data.items():
            if k in ["pan_number", "bank_name", "bank_account_no", "ifsc_code",
                     "new_doctor_name", "new_doctor_speciality", "new_doctor_city"]:
                setattr(a, k, v)

    a.hcp_form_submitted_at = datetime.utcnow()
    old = a.status
    a.status = BrsStatus.PENDING_SURVEY
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "HCP Details Submitted via Portal", old, BrsStatus.PENDING_SURVEY)
    db.commit()
    return {"ok": True, "status": a.status}


@router.post("/portal/{token}/send-otp")
def portal_send_otp(token: str, db: Session = Depends(get_db)):
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid link")
    if a.status not in [BrsStatus.PENDING_SURVEY, BrsStatus.PENDING_SIGN]:
        raise HTTPException(400, "OTP not applicable at this stage")

    # Invalidate previous OTPs
    db.query(BrsOtp).filter(
        BrsOtp.application_id == a.id, BrsOtp.used == False
    ).delete()

    otp_code = "".join(random.choices(string.digits, k=4))
    doc = _get_doctor_display(a)
    otp = BrsOtp(
        application_id=a.id,
        otp_code=otp_code,
        mobile=doc.get("phone", ""),
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(otp)
    db.commit()

    import logging
    logging.getLogger(__name__).info(
        f"[OTP] BRS {a.brs_code} | Mobile: {doc.get('phone')} | OTP: {otp_code}"
    )
    # In production: send via SMS gateway
    return {"ok": True, "message": "OTP sent to registered mobile",
            "_dev_otp": otp_code}  # remove in production


@router.post("/portal/{token}/submit-survey")
def portal_submit_survey(token: str, data: dict, db: Session = Depends(get_db)):
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid link")
    if a.status not in [BrsStatus.PENDING_SURVEY]:
        raise HTTPException(400, "Survey not available at this stage")

    a.survey_responses = data.get("responses", {})
    a.survey_started_at = a.survey_started_at or datetime.utcnow()
    a.survey_completed_at = datetime.utcnow()
    old = a.status
    a.status = BrsStatus.PENDING_SIGN
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Survey Completed via Portal", old, BrsStatus.PENDING_SIGN)
    db.commit()
    return {"ok": True, "status": a.status}


@router.post("/portal/{token}/sign")
def portal_sign(token: str, data: dict, db: Session = Depends(get_db)):
    """Verify OTP and save digital signature."""
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid link")
    if a.status != BrsStatus.PENDING_SIGN:
        raise HTTPException(400, "Signature not applicable at this stage")

    otp_input = data.get("otp")
    signature_data = data.get("signature_data")  # base64 PNG

    if not otp_input or not signature_data:
        raise HTTPException(400, "OTP and signature are required")

    # Verify OTP
    otp_record = (db.query(BrsOtp)
                  .filter(BrsOtp.application_id == a.id, BrsOtp.used == False,
                          BrsOtp.expires_at > datetime.utcnow())
                  .order_by(desc(BrsOtp.created_at))
                  .first())

    if not otp_record or otp_record.otp_code != str(otp_input):
        raise HTTPException(400, "Invalid or expired OTP")

    # Save signature image
    try:
        if "," in signature_data:
            signature_data = signature_data.split(",", 1)[1]
        img_bytes = base64.b64decode(signature_data)
        sig_path = f"{UPLOADS_DIR}/signatures/brs_{a.id}_{int(datetime.utcnow().timestamp())}.png"
        with open(sig_path, "wb") as f:
            f.write(img_bytes)
        a.signature_image_path = sig_path
    except Exception:
        raise HTTPException(400, "Invalid signature image data")

    otp_record.used = True
    a.signature_otp_verified = True
    a.agreement_signed_at = datetime.utcnow()
    old = a.status
    a.status = BrsStatus.SURVEY_COMPLETED
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Agreement Signed Digitally via Portal",
               old, BrsStatus.SURVEY_COMPLETED)
    db.commit()
    return {"ok": True, "status": a.status}


@router.post("/portal/{token}/start-survey")
def portal_start_survey(token: str, db: Session = Depends(get_db)):
    a = db.query(BrsApplication).filter(BrsApplication.survey_token == token).first()
    if not a:
        raise HTTPException(404, "Invalid link")
    if not a.survey_started_at:
        a.survey_started_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


# After survey completed, coordinator picks it up
@router.post("/{app_id}/complete-survey")
def complete_survey(app_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    a = _app_or_404(db, app_id)
    if a.status != BrsStatus.SURVEY_COMPLETED:
        raise HTTPException(400, f"Expected Survey Completed, got {a.status}")
    old = a.status
    a.status = BrsStatus.PENDING_COORD_VERIFICATION
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Moved to Coord. Verification", old,
               BrsStatus.PENDING_COORD_VERIFICATION, current_user.id)
    db.commit()
    return {"status": a.status}


# ─────────────────────────────────────────────
#  Helpers (agreement template)
# ─────────────────────────────────────────────

def _default_agreement(a: BrsApplication) -> str:
    doc = _get_doctor_display(a)
    name = doc.get("name", "Doctor")
    city = doc.get("city") or a.new_doctor_city or ""
    brand = a.brand or "the product"
    field = a.therapeutic_area or (a.topic[:80] if a.topic else "") or "the mentioned therapeutic area"
    amount = float(a.honorarium_amount or 0)
    amount_fmt = f"{amount:,.0f}"
    amount_words = _num_to_words(amount)
    pan = a.pan_number or "__________________________"
    date_str = datetime.utcnow().strftime("%d %B %Y")

    return f"""EXPERT SERVICES AGREEMENT (Survey)

DR. {name}
Address: {city}
Place / HQ: {city}

Dear Dr. {name},

We wish to seek your expert advice on usage of {brand} and its combination in different age group of patients and in furtherance to our discussion in this regard, we are pleased to appoint you as an Expert representing Emcure Pharmaceuticals Limited (hereinafter referred to as 'Emcure / Company'). You are requested to perform the following activities as an 'Expert' (hereinafter referred to as 'purpose')

Advise and update the Company on developments and issues in the field of {field}, in form of written opinions or expert survey reports. Emcure reserves the right to publish any lecture/talk given by you in such scientific congresses/conferences / meetings / seminars in any medical journals, make CDs and/or DVDs and you shall allow the Company to distribute copies of your printed lecture series and/or CDs/DVDs to the doctors in India, post your approval. The 'period' for your services shall begin on the date you sign this Agreement and shall continue for a period of one (1) year or such earlier period as the Company may deem appropriate to end your services, if in the Company's opinion you have adequately fulfilled your service ('Term'). On expiry of the Term, this Agreement shall stand expired unless renewed mutually by both parties. Emcure retains the right to terminate this Agreement without cause, by giving a ten (10) days written intimation to you.

i. In exchange for you acting as our Expert in accordance with this Agreement, Emcure will pay you by cheque or e-transfer (in your name only) into your nominated account a onetime service fee INR {amount_fmt}/- (INR {amount_words} Only) ('fees') for rendering expert services to the Company. Emcure will make such payment subject to necessary statutory deductions of withholding tax at the prevailing rates as per The Income Tax Act, 1961 and necessary certificate for the same will be provided to you. Unpublished, except for information that is already known to you (as evidenced by written records) or is or becomes public knowledge through no fault of your own. You also agree not to disclose any confidential or proprietary information to the Company.

ii. Any fees, payments, reimbursements shall be inclusive of lecture preparation, presentation, presentation preparation, meeting preparation and meeting participation, minutes review, follow-up time and review of conclusions that the Company may require you to perform. The fees, payments, reimbursements are inclusive of indirect tax, if any, travel time compensation and preparation time compensation, unless mentioned separately herein. You will be responsible for all other taxes relating to such payments. Emcure will pay and organize directly or reimburse your conference registration fees incurred by you only in case you are acting as a speaker. Emcure does not permit sponsorship of any accompanying person. Reimbursements of any expense is strictly subject to production of original receipts and other evidence of payment and written pre approval of Emcure. Submission of pan card copy, RTGS details in prescribed format are essential for processing any payments.

The following shall be an integral part of the deliverable to be provided by you to the Company:
i. Your opinion/surveys on the topics for which your expert advice has been sought for under this Agreement on your letter head.

Emcure confirms that your responsibilities as Emcure's Expert are in no way linked to or dependent on your prescribing or promoting Emcure's products. Further you acknowledge that your appointment as our Expert is only for rendering your expert advice on the above mentioned subjects. Payments and reimbursements under this Agreement strictly carry no obligation to promote any product and it is not with the intention to induce, influence or reward the past, present or future prescribing, supply, purchasing or recommending of any Emcure or its affiliates products (including formulary recommendations.).

You further agree to immediately notify Emcure should you be so debarred, excluded, disqualified or restricted, or should a penalty or action be initiated against you by Medical Council of India or any other regulatory or judicial body, at any time during the term of this Agreement and during the twelve (12) months following the expiration or termination of the Agreement.

You agree to fulfill all the obligations under this Agreement in accordance with any professional standards, applicable laws and regulations. Further it shall be your responsibility for obtaining written approvals, if any, from your principal, e.g. hospital.

By signing below, you agree not to use or disclose to third parties any confidential information which you will have access to during the course of providing service for so long as it remains unpublished, except for information that is already known to you or is or becomes public knowledge through no fault of our own. You also agree not to disclose any confidential or proprietary information to the Company.

During the period of this Agreement, any documentation and data (i) disclosed by the Company to you, or (ii) of which you would become aware or (iii) that you may create within the scope and during the performance of this agreement and (iv) any invention or improvements relating to intellectual property concerning the purpose mentioned hereinabove shall be the sole and exclusive property of Emcure.

You confirm that you have no conflict of interest which would prevent you from acting as an Expert in accordance with this Agreement and that you have obtained all necessary employer/governmental consents. You further agree to notify Emcure in writing as soon as possible if you become aware of conflict of interest during the period of this Agreement.

This Agreement is governed by and constructed in accordance with laws of India. Any dispute arising out of this Agreement shall be decided by arbitration under the Arbitration and Conciliation Act, 1996 at Pune.

────────────────────────────────────────────────────────
                 EMCURE PHARMACEUTICALS LTD.
────────────────────────────────────────────────────────
Please sign this document as receipt and acceptance of this Agreement.

Agree to and accepted by the Expert

Signed: ______________________     Date: {date_str}
Print Name: Dr. {name}
PAN NO: {pan}
────────────────────────────────────────────────────────"""


def _num_to_words(n: float) -> str:
    n = int(n)
    if n == 0:
        return "Zero"
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens_w = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def _below_hundred(x):
        return ones[x] if x < 20 else tens_w[x // 10] + (" " + ones[x % 10] if x % 10 else "")

    def _below_thousand(x):
        if x < 100:
            return _below_hundred(x)
        return ones[x // 100] + " Hundred" + (" " + _below_hundred(x % 100) if x % 100 else "")

    parts = []
    if n >= 10000000:
        parts.append(_below_thousand(n // 10000000) + " Crore")
        n %= 10000000
    if n >= 100000:
        parts.append(_below_thousand(n // 100000) + " Lakh")
        n %= 100000
    if n >= 1000:
        parts.append(_below_thousand(n // 1000) + " Thousand")
        n %= 1000
    if n > 0:
        parts.append(_below_thousand(n))
    return " ".join(parts)


# ─────────────────────────────────────────────
#  Doctor Portal — OTP Login & Profile
# ─────────────────────────────────────────────

@router.post("/doctor-portal/send-otp")
def doctor_portal_send_otp(email: str, db: Session = Depends(get_db)):
    doctor = db.query(HcpDoctor).filter(HcpDoctor.email == email, HcpDoctor.is_active == True).first()
    otp = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires = datetime.utcnow() + timedelta(minutes=10)
    session = DoctorPortalSession(
        email=email,
        hcp_doctor_id=doctor.id if doctor else None,
        otp_code=otp,
        expires_at=expires,
    )
    db.add(session)
    db.commit()
    import logging
    logging.getLogger("brs").info(f"[DEV] Doctor portal OTP for {email}: {otp}")
    return {"ok": True, "_dev_otp": otp, "doctor_found": doctor is not None}


@router.post("/doctor-portal/verify-otp")
def doctor_portal_verify_otp(email: str, otp: str, db: Session = Depends(get_db)):
    session = (db.query(DoctorPortalSession)
               .filter(DoctorPortalSession.email == email,
                       DoctorPortalSession.otp_code == otp,
                       DoctorPortalSession.used == False,
                       DoctorPortalSession.expires_at > datetime.utcnow())
               .order_by(DoctorPortalSession.created_at.desc())
               .first())
    if not session:
        raise HTTPException(400, "Invalid or expired OTP")
    token = secrets.token_urlsafe(40)
    session.session_token = token
    session.used = True
    db.commit()
    return {"session_token": token, "email": email,
            "doctor_found": session.hcp_doctor_id is not None}


@router.get("/doctor-portal/profile")
def doctor_portal_profile(session_token: str, db: Session = Depends(get_db)):
    session = db.query(DoctorPortalSession).filter(
        DoctorPortalSession.session_token == session_token).first()
    if not session:
        raise HTTPException(401, "Invalid session")
    d = session.hcp_doctor
    if not d:
        return {"email": session.email, "found": False}
    return {
        "found": True,
        "id": d.id, "email": d.email,
        "full_name": d.full_name or f"{d.first_name or ''} {d.last_name or ''}".strip(),
        "first_name": d.first_name, "last_name": d.last_name,
        "mobile_number": d.mobile_number,
        "qualification": d.qualification,
        "doctor_type": d.doctor_type,
        "city": d.city, "state": d.state,
        "address": d.address,
        "pan_number": d.pan_number or "",
        "bank_name": d.bank_name or "",
        "account_number": d.account_number or "",
        "ifsc_code": d.ifsc_code or "",
        "name_as_per_bank": d.name_as_per_bank or "",
        "mci_reg_number": d.mci_reg_number or "",
        "is_registered_under_gst": d.is_registered_under_gst,
        "pending_surveys": _get_doctor_pending_surveys(d.id, db),
    }


@router.put("/doctor-portal/profile")
def doctor_portal_update_profile(session_token: str, data: dict, db: Session = Depends(get_db)):
    session = db.query(DoctorPortalSession).filter(
        DoctorPortalSession.session_token == session_token).first()
    if not session or not session.hcp_doctor_id:
        raise HTTPException(401, "Invalid session or no doctor profile found")
    d = session.hcp_doctor
    allowed = ["pan_number", "bank_name", "account_number", "ifsc_code",
               "name_as_per_bank", "mobile_number", "address", "city", "state"]
    for k, v in data.items():
        if k in allowed and v is not None:
            setattr(d, k, v)
    db.commit()
    return {"ok": True}


def _get_doctor_pending_surveys(hcp_doctor_id: int, db: Session) -> list:
    apps = (db.query(BrsApplication)
            .filter(BrsApplication.hcp_doctor_id == hcp_doctor_id,
                    BrsApplication.status.in_([
                        BrsStatus.PENDING_HCP_FORM, BrsStatus.PENDING_SURVEY,
                        BrsStatus.PENDING_SIGN
                    ]))
            .all())
    return [{"brs_code": a.brs_code, "survey_title": a.survey_title,
             "status": a.status, "token": a.survey_token,
             "deadline_at": a.survey_deadline_at.isoformat() if a.survey_deadline_at else None}
            for a in apps]


# ─────────────────────────────────────────────
#  Bulk BRS Requests
# ─────────────────────────────────────────────

def _generate_bulk_code(db: Session) -> str:
    from datetime import date
    prefix = f"BRSB{date.today().strftime('%Y%m')}"
    last = (db.query(BrsBulkRequest)
            .filter(BrsBulkRequest.bulk_code.like(f"{prefix}%"))
            .order_by(desc(BrsBulkRequest.bulk_code)).first())
    seq = int(last.bulk_code[len(prefix):]) + 1 if last and last.bulk_code else 1
    return f"{prefix}{seq:04d}"


@router.get("/bulk/")
def list_bulk_requests(
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reqs = db.query(BrsBulkRequest).order_by(desc(BrsBulkRequest.created_at)).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id, "bulk_code": r.bulk_code,
            "survey_title": r.survey_title, "brand": r.brand,
            "honorarium_amount": float(r.honorarium_amount or 0),
            "total_doctors": r.total_doctors, "sent_count": r.sent_count,
            "completed_count": r.completed_count, "status": r.status,
            "initiator_name": f"{r.initiator.first_name} {r.initiator.last_name}" if r.initiator else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reqs
    ]


@router.post("/bulk/")
def create_bulk_request(data: dict, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMINISTRATOR:
        raise HTTPException(403, "System administrators cannot initiate BRS applications.")
    doctors = data.pop("doctors", [])
    bulk = BrsBulkRequest(
        bulk_code=_generate_bulk_code(db),
        survey_title=data["survey_title"],
        survey_id=data.get("survey_id"),
        therapeutic_area=data.get("therapeutic_area"),
        brand=data.get("brand"),
        topic=data.get("topic"),
        honorarium_amount=data.get("honorarium_amount"),
        survey_duration_days=data.get("survey_duration_days", 7),
        mode=data.get("mode", "Online"),
        division_id=data.get("division_id"),
        cost_center=data.get("cost_center"),
        company_code=data.get("company_code"),
        remarks=data.get("remarks"),
        initiator_id=current_user.id,
        status="Draft",
        total_doctors=len(doctors),
    )
    db.add(bulk)
    db.flush()

    created_apps = []
    for doc in doctors:
        hcp_id = doc.get("hcp_doctor_id")
        app = BrsApplication(
            brs_code=_generate_brs_code(db),
            survey_title=bulk.survey_title,
            therapeutic_area=bulk.therapeutic_area,
            brand=bulk.brand,
            topic=bulk.topic,
            mode=bulk.mode,
            survey_duration_days=bulk.survey_duration_days,
            honorarium_amount=bulk.honorarium_amount,
            division_id=bulk.division_id,
            cost_center=bulk.cost_center,
            company_code=bulk.company_code,
            remarks=bulk.remarks,
            survey_id=bulk.survey_id,
            hcp_doctor_id=hcp_id if hcp_id else None,
            is_new_doctor=not bool(hcp_id),
            new_doctor_name=doc.get("name") if not hcp_id else None,
            new_doctor_email=doc.get("email") if not hcp_id else None,
            new_doctor_phone=doc.get("phone") if not hcp_id else None,
            new_doctor_speciality=doc.get("speciality") if not hcp_id else None,
            new_doctor_city=doc.get("city") if not hcp_id else None,
            bulk_request_id=bulk.id,
            initiator_id=current_user.id,
            status=BrsStatus.DRAFT,
        )
        db.add(app)
        db.flush()
        _add_audit(db, app.id, "Created (Bulk)", "", BrsStatus.DRAFT, current_user.id)
        created_apps.append(app.brs_code)

    db.commit()
    return {"id": bulk.id, "bulk_code": bulk.bulk_code,
            "total_doctors": len(doctors), "brs_codes": created_apps}


@router.get("/bulk/{bulk_id}")
def get_bulk_request(bulk_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    bulk = db.query(BrsBulkRequest).filter(BrsBulkRequest.id == bulk_id).first()
    if not bulk:
        raise HTTPException(404, "Bulk request not found")
    apps = db.query(BrsApplication).filter(BrsApplication.bulk_request_id == bulk_id).all()
    return {
        "id": bulk.id, "bulk_code": bulk.bulk_code,
        "survey_title": bulk.survey_title,
        "brand": bulk.brand, "therapeutic_area": bulk.therapeutic_area,
        "honorarium_amount": float(bulk.honorarium_amount or 0),
        "survey_duration_days": bulk.survey_duration_days,
        "total_doctors": bulk.total_doctors,
        "sent_count": bulk.sent_count,
        "completed_count": bulk.completed_count,
        "status": bulk.status,
        "initiator_name": f"{bulk.initiator.first_name} {bulk.initiator.last_name}" if bulk.initiator else None,
        "created_at": bulk.created_at.isoformat() if bulk.created_at else None,
        "doctors": [
            {
                "id": a.id, "brs_code": a.brs_code,
                "doctor": _get_doctor_display(a),
                "status": a.status,
                "survey_link_sent_at": a.survey_link_sent_at.isoformat() if a.survey_link_sent_at else None,
                "survey_completed_at": a.survey_completed_at.isoformat() if a.survey_completed_at else None,
                "agreement_signed_at": a.agreement_signed_at.isoformat() if a.agreement_signed_at else None,
                "survey_deadline_at": a.survey_deadline_at.isoformat() if a.survey_deadline_at else None,
            }
            for a in apps
        ]
    }


@router.post("/bulk/{bulk_id}/submit")
def submit_bulk_request(bulk_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    """Submit all draft applications in the bulk request for L1 approval."""
    bulk = db.query(BrsBulkRequest).filter(BrsBulkRequest.id == bulk_id).first()
    if not bulk:
        raise HTTPException(404, "Bulk request not found")
    apps = db.query(BrsApplication).filter(
        BrsApplication.bulk_request_id == bulk_id,
        BrsApplication.status == BrsStatus.DRAFT).all()
    initiator = db.query(User).filter(User.id == current_user.id).first()
    l1 = db.query(User).filter(User.id == initiator.manager_id).first() if initiator and initiator.manager_id else None
    l2 = db.query(User).filter(User.id == l1.manager_id).first() if l1 and l1.manager_id else None
    for a in apps:
        if l1: a.l1_approver_id = l1.id
        if l2: a.l2_approver_id = l2.id
        a.status = BrsStatus.PENDING_L1
        a.updated_at = datetime.utcnow()
        _add_audit(db, a.id, "Submitted (Bulk)", BrsStatus.DRAFT, BrsStatus.PENDING_L1, current_user.id)
    bulk.status = "Pending L1"
    db.commit()
    return {"submitted": len(apps), "status": "Pending L1"}
