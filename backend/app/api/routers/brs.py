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
from app.models.user import User
from app.models.brs import (
    BrsApplication, BrsStatus, BrsSurvey, BrsSurveyQuestion,
    BrsQuestionType, BrsAuditTrail, BrsOtp
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
            "name": d.name, "email": d.email, "phone": d.mobile_no,
            "speciality": d.speciality, "city": d.city
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
    app = BrsApplication(
        brs_code=_generate_brs_code(db),
        survey_title=data["survey_title"],
        therapeutic_area=data.get("therapeutic_area"),
        brand=data.get("brand"),
        topic=data.get("topic"),
        mode=data.get("mode", "Online"),
        survey_duration_minutes=data.get("survey_duration_minutes", 30),
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
        pan_number=data.get("pan_number"),
        bank_name=data.get("bank_name"),
        bank_account_no=data.get("bank_account_no"),
        ifsc_code=data.get("ifsc_code"),
        survey_id=data.get("survey_id"),
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
        "survey_duration_minutes": a.survey_duration_minutes,
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
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "initiator": {"id": a.initiator.id,
                      "name": f"{a.initiator.first_name} {a.initiator.last_name}"} if a.initiator else None,
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
    a.status = BrsStatus.PENDING_L1
    a.updated_at = datetime.utcnow()
    _add_audit(db, a.id, "Submitted for L1 Approval", old, BrsStatus.PENDING_L1, current_user.id)
    db.commit()
    return {"status": a.status}


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
        "survey_duration_minutes": a.survey_duration_minutes,
        "doctor": doc,
        "pan_number": a.pan_number,
        "bank_name": a.bank_name,
        "bank_account_no": a.bank_account_no,
        "ifsc_code": a.ifsc_code,
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
    allowed = ["pan_number", "bank_name", "bank_account_no", "ifsc_code",
               "new_doctor_name", "new_doctor_speciality", "new_doctor_city"]
    for k, v in data.items():
        if k in allowed:
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
    return f"""BONA FIDE RESEARCH SURVEY AGREEMENT

This agreement is entered into between:

Emcure Pharmaceuticals Ltd. ("Emcure")
AND
Dr. {name} ("Investigator")

TERMS AND CONDITIONS:

1. NATURE OF ENGAGEMENT
The Investigator agrees to participate in a Bona Fide Research Survey titled:
"{a.survey_title}"

This engagement is for legitimate medical research purposes as defined under applicable guidelines.

2. HONORARIUM
Emcure agrees to pay an honorarium of INR {float(a.honorarium_amount or 0):,.0f}/- (Rupees {_num_to_words(float(a.honorarium_amount or 0))}) upon completion of the survey, subject to deduction of applicable taxes (TDS).

3. OBLIGATIONS OF INVESTIGATOR
The Investigator agrees to:
a) Complete the survey in good faith with accurate responses
b) Devote adequate time (minimum {a.survey_duration_minutes} minutes) to the survey
c) Provide all required KYC documents (PAN card, bank details)

4. CONFIDENTIALITY
All survey responses and related information shall be kept confidential by Emcure and used solely for internal research and medical affairs purposes.

5. COMPLIANCE
This engagement complies with:
- MCI Code of Ethics
- UCPMP guidelines
- Applicable Indian tax laws

6. DECLARATION
I, Dr. {name}, declare that:
- The information provided by me is true and accurate
- I am participating in this survey voluntarily
- I understand that the honorarium is subject to applicable tax deductions

By digitally signing this agreement, I confirm my acceptance of all terms and conditions.

Date: {datetime.utcnow().strftime('%d %B %Y')}
"""


def _num_to_words(n: float) -> str:
    """Very basic number to words for agreement template."""
    n = int(n)
    if n == 0:
        return "Zero"
    if n < 1000:
        return str(n)
    if n < 100000:
        return f"{n // 1000} Thousand {n % 1000}" if n % 1000 else f"{n // 1000} Thousand"
    return str(n)
