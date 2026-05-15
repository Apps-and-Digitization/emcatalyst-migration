from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
import os, shutil, uuid
from pydantic import BaseModel
from app.db.base import get_db
from app.models.event import Event, EventDoctor, EventCost, EventDocument, EventHonorarium, EventStatus, EventAgreement, EventAuditTrail, EventMeal
from app.models.master import HcpDoctor
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventOut, EventDoctorCreate, EventDoctorOut, EventCostCreate, EventCostOut
from app.api.deps import get_current_active_user

router = APIRouter(prefix="/events", tags=["events"])

UPLOAD_DIR = "uploads/events"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _add_event_audit(db: Session, event_id: int, action: str, from_s: str, to_s: str, user_id: int = None, remarks: str = ""):
    db.add(EventAuditTrail(event_id=event_id, action=action, from_status=from_s, to_status=to_s, performed_by_id=user_id, remarks=remarks))


def _deduct_budget(db: Session, event, user_id: int = None):
    """
    Deduct budget on pre-event submission:
    - Speaker Cost budget: sum of honorarium from all doctors
    - Sponsorship/Event Cost budget: total event cost + sum of cab + flight + accommodation
    Uses event_date month/year and division_id to find the matching budget rows.
    """
    from app.models.master import MasterBudget, BudgetAuditTrail
    from decimal import Decimal

    if not event.event_date or not event.division_id:
        return

    # Determine the month (first day of event month)
    event_month_start = event.event_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Calculate speaker cost (sum of honorarium from all doctors)
    speaker_cost = sum(float(d.honorarium or 0) for d in event.doctors)

    # Calculate event cost (venue + AV + meals + other + cab + flight + accommodation)
    event_cost = float(event.venue_charges or 0) + float(event.av_platform_cost or 0) + float(event.other_amount or 0)
    # Add total meal cost
    if event.meals:
        total_attendees = (event.proposed_emcure_attendees or 0) + (event.num_hcps_professional_services or 0) + (event.proposed_num_hcps or 0)
        for meal in event.meals:
            event_cost += float(meal.cost_per_attendee or 0) * total_attendees
    # Add travel costs from doctors
    for d in event.doctors:
        event_cost += float(d.cab_cost or 0) + float(d.flight_cost or 0) + float(d.accommodation_cost or 0)

    # Deduct from Speaker Cost budget
    if speaker_cost > 0:
        speaker_budget = db.query(MasterBudget).filter(
            MasterBudget.division_id == event.division_id,
            MasterBudget.budget_type == "Speaker Cost",
            MasterBudget.budget_month == event_month_start,
            MasterBudget.is_active == True,
        ).first()
        if speaker_budget:
            speaker_budget.utilized_budget = Decimal(str(float(speaker_budget.utilized_budget or 0) + speaker_cost))
            db.add(BudgetAuditTrail(
                budget_id=speaker_budget.id, action="Deducted", amount=speaker_cost,
                description=f"Speaker cost \u20b9{speaker_cost:,.0f} deducted for Event {event.event_code or event.id}",
                performed_by_id=user_id, event_code=event.event_code,
            ))

    # Deduct from Sponsorship/Event Cost budget
    if event_cost > 0:
        event_budget = db.query(MasterBudget).filter(
            MasterBudget.division_id == event.division_id,
            MasterBudget.budget_type == "Sponsorship/Event Cost",
            MasterBudget.budget_month == event_month_start,
            MasterBudget.is_active == True,
        ).first()
        if event_budget:
            event_budget.utilized_budget = Decimal(str(float(event_budget.utilized_budget or 0) + event_cost))
            db.add(BudgetAuditTrail(
                budget_id=event_budget.id, action="Deducted", amount=event_cost,
                description=f"Event cost \u20b9{event_cost:,.0f} deducted for Event {event.event_code or event.id}",
                performed_by_id=user_id, event_code=event.event_code,
            ))


def generate_event_code(db: Session) -> str:
    count = db.query(Event).count() + 1
    return f"EC{datetime.now().strftime('%Y%m')}{count:04d}"


@router.get("/")
def list_events(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    division_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    q = db.query(Event)
    if status:
        q = q.filter(Event.status == status)
    if division_id:
        q = q.filter(Event.division_id == division_id)
    events = q.order_by(Event.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": e.id,
            "event_code": e.event_code,
            "event_title": e.event_title,
            "event_type": e.event_type,
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_end_date": e.event_end_date.isoformat() if e.event_end_date else None,
            "city": e.city,
            "status": e.status,
            "division_id": e.division_id,
            "budget_amount": float(e.budget_amount) if e.budget_amount else None,
            "initiator_id": e.initiator_id,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.post("/", response_model=EventOut)
def create_event(
    data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = Event(**data.model_dump(), initiator_id=current_user.id, step=1)
    event.event_code = generate_event_code(db)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    # Build response with audit trail
    data = EventOut.model_validate(event).model_dump()
    # Add audit trail
    data["audit_trail"] = [
        {
            "id": t.id,
            "action": t.action,
            "from_status": t.from_status,
            "to_status": t.to_status,
            "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else "System",
            "remarks": t.remarks,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in (event.audit_trail or [])
    ]
    # Add initiator info
    if event.initiator:
        data["initiator_name"] = f"{event.initiator.first_name} {event.initiator.last_name}"
        data["initiator_employee_id"] = event.initiator.employee_id
        data["initiator_designation"] = event.initiator.designation_title
    # Add approver names
    if event.l1_approver:
        data["l1_approver_name"] = f"{event.l1_approver.first_name} {event.l1_approver.last_name}"
    if event.l2_approver:
        data["l2_approver_name"] = f"{event.l2_approver.first_name} {event.l2_approver.last_name}"
    # Add division name
    if event.division_id:
        from app.models.user import Division
        div = db.query(Division).filter(Division.id == event.division_id).first()
        data["division_name"] = div.name if div else None
    return data


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}/change-date")
def change_event_date(
    event_id: int,
    new_date: str,  # YYYY-MM-DD format
    new_end_date: Optional[str] = None,  # YYYY-MM-DD format
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Admin only: Change event date with budget reversal and re-deduction."""
    if current_user.role != "Administrator" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only administrators can change event dates")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from datetime import datetime as dt
    from app.models.master import MasterBudget, BudgetAuditTrail

    new_event_date = dt.strptime(new_date, "%Y-%m-%d")
    old_event_date = event.event_date

    # Only process budget changes if event has been submitted (budget was deducted)
    if event.status != "Draft" and event.division_id and old_event_date:
        old_month_start = old_event_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_month_start = new_event_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Only reverse/re-deduct if month actually changed
        if old_month_start != new_month_start:
            # Calculate costs (same logic as _deduct_budget)
            speaker_cost = sum(float(d.honorarium or 0) for d in event.doctors)
            event_cost = float(event.venue_charges or 0) + float(event.av_platform_cost or 0) + float(event.other_amount or 0)
            if event.meals:
                total_attendees = (event.proposed_emcure_attendees or 0) + (event.num_hcps_professional_services or 0) + (event.proposed_num_hcps or 0)
                for meal in event.meals:
                    event_cost += float(meal.cost_per_attendee or 0) * total_attendees
            for d in event.doctors:
                event_cost += float(d.cab_cost or 0) + float(d.flight_cost or 0) + float(d.accommodation_cost or 0)

            # Check if new month has budget
            new_speaker_budget = db.query(MasterBudget).filter(
                MasterBudget.division_id == event.division_id,
                MasterBudget.budget_type == "Speaker Cost",
                MasterBudget.budget_month == new_month_start,
                MasterBudget.is_active == True,
            ).first()

            new_event_budget = db.query(MasterBudget).filter(
                MasterBudget.division_id == event.division_id,
                MasterBudget.budget_type == "Sponsorship/Event Cost",
                MasterBudget.budget_month == new_month_start,
                MasterBudget.is_active == True,
            ).first()

            # Validate budget exists for new month
            if not new_speaker_budget and not new_event_budget:
                raise HTTPException(status_code=400, detail="No budget allocated for the new event month")

            # Validate remaining budget in new month
            if speaker_cost > 0 and new_speaker_budget:
                remaining = float(new_speaker_budget.allocated_budget) - float(new_speaker_budget.utilized_budget or 0)
                if speaker_cost > remaining:
                    raise HTTPException(status_code=400, detail=f"Speaker cost (₹{speaker_cost:,.0f}) exceeds remaining Speaker budget (₹{remaining:,.0f}) for the new month")

            if event_cost > 0 and new_event_budget:
                remaining = float(new_event_budget.allocated_budget) - float(new_event_budget.utilized_budget or 0)
                if event_cost > remaining:
                    raise HTTPException(status_code=400, detail=f"Event cost (₹{event_cost:,.0f}) exceeds remaining Event budget (₹{remaining:,.0f}) for the new month")

            # Reverse from old month
            old_speaker_budget = db.query(MasterBudget).filter(
                MasterBudget.division_id == event.division_id,
                MasterBudget.budget_type == "Speaker Cost",
                MasterBudget.budget_month == old_month_start,
                MasterBudget.is_active == True,
            ).first()

            old_event_budget = db.query(MasterBudget).filter(
                MasterBudget.division_id == event.division_id,
                MasterBudget.budget_type == "Sponsorship/Event Cost",
                MasterBudget.budget_month == old_month_start,
                MasterBudget.is_active == True,
            ).first()

            if old_speaker_budget and speaker_cost > 0:
                old_speaker_budget.utilized_budget = Decimal(str(max(0, float(old_speaker_budget.utilized_budget or 0) - speaker_cost)))
                db.add(BudgetAuditTrail(budget_id=old_speaker_budget.id, action="Reversed", amount=speaker_cost, description=f"Reversed ₹{speaker_cost:,.0f} - Event {event.event_code} date changed", performed_by_id=current_user.id, event_code=event.event_code))

            if old_event_budget and event_cost > 0:
                old_event_budget.utilized_budget = Decimal(str(max(0, float(old_event_budget.utilized_budget or 0) - event_cost)))
                db.add(BudgetAuditTrail(budget_id=old_event_budget.id, action="Reversed", amount=event_cost, description=f"Reversed ₹{event_cost:,.0f} - Event {event.event_code} date changed", performed_by_id=current_user.id, event_code=event.event_code))

            # Deduct from new month
            if new_speaker_budget and speaker_cost > 0:
                new_speaker_budget.utilized_budget = Decimal(str(float(new_speaker_budget.utilized_budget or 0) + speaker_cost))
                db.add(BudgetAuditTrail(budget_id=new_speaker_budget.id, action="Deducted", amount=speaker_cost, description=f"Speaker cost ₹{speaker_cost:,.0f} deducted - Event {event.event_code} date changed", performed_by_id=current_user.id, event_code=event.event_code))

            if new_event_budget and event_cost > 0:
                new_event_budget.utilized_budget = Decimal(str(float(new_event_budget.utilized_budget or 0) + event_cost))
                db.add(BudgetAuditTrail(budget_id=new_event_budget.id, action="Deducted", amount=event_cost, description=f"Event cost ₹{event_cost:,.0f} deducted - Event {event.event_code} date changed", performed_by_id=current_user.id, event_code=event.event_code))

    # Update the event dates
    event.event_date = new_event_date
    if new_end_date:
        from datetime import datetime as dt2
        event.event_end_date = dt2.strptime(new_end_date, "%Y-%m-%d")
    # Add audit trail
    end_info = f" to {new_end_date}" if new_end_date else ""
    db.add(EventAuditTrail(event_id=event.id, action="Date Changed", from_status=event.status, to_status=event.status, performed_by_id=current_user.id, remarks=f"Date changed from {old_event_date.strftime('%d %b %Y') if old_event_date else 'N/A'} to {new_event_date.strftime('%d %b %Y')}{end_info}"))
    db.commit()
    return {"ok": True, "message": f"Event date changed to {new_event_date.strftime('%d %b %Y')}"}


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    # Admin can delete any event, others can only delete drafts
    if event.status != EventStatus.DRAFT:
        if current_user.role != "Administrator" and not current_user.is_superuser:
            raise HTTPException(status_code=400, detail="Only draft events can be deleted")
    # Delete related records
    db.query(EventDoctor).filter(EventDoctor.event_id == event_id).delete()
    db.query(EventCost).filter(EventCost.event_id == event_id).delete()
    db.query(EventDocument).filter(EventDocument.event_id == event_id).delete()
    db.query(EventAuditTrail).filter(EventAuditTrail.event_id == event_id).delete()
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


@router.post("/{event_id}/submit", response_model=EventOut)
def submit_event(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.workflow_service import get_first_step, resolve_approver

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft events can be submitted")

    # Validate mandatory documents
    from app.models.event import EventDocumentType, EventDocument
    mandatory_docs = db.query(EventDocumentType).filter(
        EventDocumentType.event_type == event.event_type,
        EventDocumentType.is_mandatory == True,
        EventDocumentType.is_active == True,
    ).all()
    if mandatory_docs:
        uploaded_types = {d.document_type for d in event.documents}
        missing = [d.document_name for d in mandatory_docs if d.document_name not in uploaded_types]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Mandatory documents missing: {', '.join(missing)}. Please upload them before submitting."
            )

    # Use workflow engine to determine first step
    first_step = get_first_step(db, "event_pre_approval")
    if first_step:
        # Resolve L1 and L2 approvers from workflow steps
        initiator = db.query(User).filter(User.id == current_user.id).first()
        l1 = resolve_approver(db, first_step, initiator)
        if l1:
            event.l1_approver_id = l1.id

        # Try to resolve L2 from second step
        from app.services.workflow_service import get_next_step
        second_step = get_next_step(db, "event_pre_approval", first_step.pending_status)
        if second_step and second_step.approver_type == "reporting_manager":
            l2 = resolve_approver(db, second_step, initiator)
            if l2:
                event.l2_approver_id = l2.id

        event.status = first_step.pending_status or EventStatus.PENDING_L1
    else:
        # Fallback to hardcoded logic if no workflow configured
        initiator = db.query(User).filter(User.id == current_user.id).first()
        l1 = db.query(User).filter(User.id == initiator.manager_id).first() if initiator and initiator.manager_id else None
        l2 = db.query(User).filter(User.id == l1.manager_id).first() if l1 and l1.manager_id else None
        if l1:
            event.l1_approver_id = l1.id
        if l2:
            event.l2_approver_id = l2.id
        event.status = EventStatus.PENDING_L1

    _add_event_audit(db, event.id, "Submitted", EventStatus.DRAFT, event.status, current_user.id, remarks or "")

    # Budget deduction on pre-event submission
    _deduct_budget(db, event, current_user.id)

    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-l1", response_model=EventOut)
def approve_l1(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.PENDING_L1:
        raise HTTPException(status_code=400, detail=f"Expected Pending L1, got {event.status}")

    # Workflow authorization check
    step = get_step_for_status(db, "event_pre_approval", EventStatus.PENDING_L1)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    from datetime import datetime, timezone
    next_status = step.approved_status if step else EventStatus.PENDING_L2
    event.status = next_status
    event.l1_approver_id = current_user.id
    event.l1_approved_at = datetime.now(timezone.utc)
    if remarks:
        event.compliance_remarks = remarks
    _add_event_audit(db, event.id, "L1 Approved", EventStatus.PENDING_L1, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-l2", response_model=EventOut)
def approve_l2(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.PENDING_L2:
        raise HTTPException(status_code=400, detail=f"Expected Pending L2, got {event.status}")

    step = get_step_for_status(db, "event_pre_approval", EventStatus.PENDING_L2)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    from datetime import datetime, timezone
    next_status = step.approved_status if step else EventStatus.PENDING_COMPLIANCE
    event.status = next_status
    event.l2_approver_id = current_user.id
    event.l2_approved_at = datetime.now(timezone.utc)
    if remarks:
        event.compliance_remarks = remarks
    _add_event_audit(db, event.id, "L2 Approved", EventStatus.PENDING_L2, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-compliance", response_model=EventOut)
def approve_compliance(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.PENDING_COMPLIANCE:
        raise HTTPException(status_code=400, detail=f"Expected Pending Compliance, got {event.status}")

    step = get_step_for_status(db, "event_pre_approval", EventStatus.PENDING_COMPLIANCE)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    from datetime import datetime, timezone
    next_status = step.approved_status if step else EventStatus.PRE_APPROVED
    event.status = next_status
    event.compliance_approved_at = datetime.now(timezone.utc)
    if remarks:
        event.compliance_remarks = remarks
    _add_event_audit(db, event.id, "Compliance Approved", EventStatus.PENDING_COMPLIANCE, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve", response_model=EventOut)
def approve_event(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = EventStatus.APPROVED
    event.approver_id = current_user.id
    if remarks:
        event.compliance_remarks = remarks
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/reject", response_model=EventOut)
def reject_event(
    event_id: int,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = EventStatus.REJECTED
    event.rejection_reason = reason
    _add_event_audit(db, event.id, "Rejected", event.status, EventStatus.REJECTED, current_user.id, reason)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}/can-approve")
def can_approve_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if current user can approve this event at its current status."""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    status = event.status
    # Not in an approvable state
    non_approvable = [EventStatus.DRAFT, EventStatus.PRE_APPROVED, EventStatus.COMPLETED, EventStatus.REJECTED, EventStatus.CANCELLED]
    if status in non_approvable:
        return {"can_approve": False, "reason": "Event is not in an approvable state"}

    # Determine which workflow to check
    pre_statuses = [EventStatus.PENDING_L1, EventStatus.PENDING_L2, EventStatus.PENDING_COMPLIANCE]
    post_statuses = [EventStatus.POST_L1, EventStatus.POST_L2, EventStatus.POST_COMPLIANCE,
                     EventStatus.POST_COORDINATOR, EventStatus.POST_GST, EventStatus.POST_FINANCE]

    workflow_key = None
    if status in pre_statuses:
        workflow_key = "event_pre_approval"
    elif status in post_statuses:
        workflow_key = "event_post_approval"

    if not workflow_key:
        return {"can_approve": False, "reason": "Unknown status for approval"}

    step = get_step_for_status(db, workflow_key, status)
    if not step:
        return {"can_approve": False, "reason": "No workflow step configured for this status"}

    can = can_user_approve_step(db, current_user, step, event.initiator_id)
    return {"can_approve": can, "step_label": step.step_label}


@router.get("/permissions/can-create")
def can_create_event(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if current user can create/initiate events based on workflow config."""
    from app.services.workflow_service import get_workflow, can_user_initiate
    wf = get_workflow(db, "event_pre_approval")
    if not wf:
        return {"can_create": True}  # No workflow = anyone can create
    return {"can_create": can_user_initiate(db, current_user, wf)}


@router.get("/permissions/workflow-steps")
def get_event_workflow_steps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return the approval workflow steps for display in the UI."""
    from app.services.workflow_service import get_workflow_steps
    pre_steps = get_workflow_steps(db, "event_pre_approval")
    post_steps = get_workflow_steps(db, "event_post_approval")
    return {
        "pre_steps": [{"step_order": s.step_order, "step_label": s.step_label, "pending_status": s.pending_status, "approved_status": s.approved_status} for s in pre_steps],
        "post_steps": [{"step_order": s.step_order, "step_label": s.step_label, "pending_status": s.pending_status, "approved_status": s.approved_status} for s in post_steps],
    }


@router.get("/permissions/check-budget")
def check_budget(
    division_id: int,
    event_date: str,  # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if budget exists for the given division and event month, return remaining amounts."""
    from app.models.master import MasterBudget
    from datetime import datetime as dt

    parsed_date = dt.strptime(event_date[:7] + "-01", "%Y-%m-%d")

    speaker_budget = db.query(MasterBudget).filter(
        MasterBudget.division_id == division_id,
        MasterBudget.budget_type == "Speaker Cost",
        MasterBudget.budget_month == parsed_date,
        MasterBudget.is_active == True,
    ).first()

    event_budget = db.query(MasterBudget).filter(
        MasterBudget.division_id == division_id,
        MasterBudget.budget_type == "Sponsorship/Event Cost",
        MasterBudget.budget_month == parsed_date,
        MasterBudget.is_active == True,
    ).first()

    return {
        "has_budget": bool(speaker_budget or event_budget),
        "speaker_budget": {
            "allocated": float(speaker_budget.allocated_budget) if speaker_budget else 0,
            "utilized": float(speaker_budget.utilized_budget or 0) if speaker_budget else 0,
            "remaining": float(speaker_budget.allocated_budget) - float(speaker_budget.utilized_budget or 0) if speaker_budget else 0,
        } if speaker_budget else None,
        "event_budget": {
            "allocated": float(event_budget.allocated_budget) if event_budget else 0,
            "utilized": float(event_budget.utilized_budget or 0) if event_budget else 0,
            "remaining": float(event_budget.allocated_budget) - float(event_budget.utilized_budget or 0) if event_budget else 0,
        } if event_budget else None,
    }


@router.post("/{event_id}/submit-post-event", response_model=EventOut)
def submit_post_event(
    event_id: int,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Initiator submits post-event documents for post-event approval chain."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status not in [EventStatus.PRE_APPROVED, EventStatus.POST_EVENT_PENDING]:
        raise HTTPException(status_code=400, detail=f"Event must be Pre-Approved or Post-Event Pending, got {event.status}")
    old = event.status
    event.status = EventStatus.POST_L1
    _add_event_audit(db, event.id, "Post-Event Documents Submitted", old, EventStatus.POST_L1, current_user.id, remarks or "Post-event documents uploaded")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-l1", response_model=EventOut)
def approve_post_l1(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_L1:
        raise HTTPException(status_code=400, detail=f"Expected Post L1, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", EventStatus.POST_L1)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    next_status = step.approved_status if step else EventStatus.POST_L2
    event.status = next_status
    _add_event_audit(db, event.id, "Post L1 Approved", old, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-l2", response_model=EventOut)
def approve_post_l2(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_L2:
        raise HTTPException(status_code=400, detail=f"Expected Post L2, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", EventStatus.POST_L2)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    next_status = step.approved_status if step else EventStatus.POST_COMPLIANCE
    event.status = next_status
    _add_event_audit(db, event.id, "Post L2 Approved", old, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-compliance", response_model=EventOut)
def approve_post_compliance(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_COMPLIANCE:
        raise HTTPException(status_code=400, detail=f"Expected Post Compliance, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", EventStatus.POST_COMPLIANCE)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    next_status = step.approved_status if step else EventStatus.POST_COORDINATOR
    event.status = next_status
    _add_event_audit(db, event.id, "Post Compliance Approved", old, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-coordinator", response_model=EventOut)
def approve_post_coordinator(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_COORDINATOR:
        raise HTTPException(status_code=400, detail=f"Expected Post Coordinator, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", EventStatus.POST_COORDINATOR)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    if step and step.approved_status:
        event.status = step.approved_status
    elif event.event_type and 'corporate' in event.event_type.lower() and 'sponsorship' in event.event_type.lower():
        event.status = EventStatus.POST_GST
    else:
        event.status = EventStatus.POST_FINANCE
    _add_event_audit(db, event.id, "Post Coordinator Approved", old, event.status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-gst", response_model=EventOut)
def approve_post_gst(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_GST:
        raise HTTPException(status_code=400, detail=f"Expected Post GST, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", "Post GST")
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    next_status = step.approved_status if step else EventStatus.POST_FINANCE
    event.status = next_status
    _add_event_audit(db, event.id, "Post GST Approved", old, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


@router.post("/{event_id}/approve-post-finance", response_model=EventOut)
def approve_post_finance(event_id: int, remarks: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != EventStatus.POST_FINANCE:
        raise HTTPException(status_code=400, detail=f"Expected Post Finance, got {event.status}")

    step = get_step_for_status(db, "event_post_approval", EventStatus.POST_FINANCE)
    if step and not can_user_approve_step(db, current_user, step, event.initiator_id):
        raise HTTPException(status_code=403, detail="You are not authorized to approve this step")

    old = event.status
    next_status = step.approved_status if step else EventStatus.COMPLETED
    event.status = next_status
    _add_event_audit(db, event.id, "Post Finance Approved - Completed", old, next_status, current_user.id, remarks or "")
    db.commit()
    db.refresh(event)
    return event


# Doctors
@router.get("/{event_id}/doctors", response_model=List[EventDoctorOut])
def list_doctors(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(EventDoctor).filter(EventDoctor.event_id == event_id).all()


@router.post("/{event_id}/doctors", response_model=EventDoctorOut)
def add_doctor(event_id: int, data: EventDoctorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not db.query(Event).filter(Event.id == event_id).first():
        raise HTTPException(status_code=404, detail="Event not found")
    doctor = EventDoctor(**data.model_dump(), event_id=event_id)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.put("/{event_id}/doctors/{doctor_id}", response_model=EventDoctorOut)
def update_doctor(event_id: int, doctor_id: int, data: EventDoctorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doctor = db.query(EventDoctor).filter(EventDoctor.id == doctor_id, EventDoctor.event_id == event_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.delete("/{event_id}/doctors/{doctor_id}")
def remove_doctor(event_id: int, doctor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doctor = db.query(EventDoctor).filter(EventDoctor.id == doctor_id, EventDoctor.event_id == event_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    db.delete(doctor)
    db.commit()
    return {"message": "Removed"}


# Event Meals
@router.get("/{event_id}/meals")
def list_event_meals(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.event import EventMeal
    meals = db.query(EventMeal).filter(EventMeal.event_id == event_id).all()
    return [{"id": m.id, "meal_name": m.meal_name, "max_cost": float(m.max_cost) if m.max_cost else None, "cost_per_attendee": float(m.cost_per_attendee) if m.cost_per_attendee else None} for m in meals]


@router.post("/{event_id}/meals")
def add_event_meal(event_id: int, meal_name: str, max_cost: Optional[float] = None, cost_per_attendee: Optional[float] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.event import EventMeal
    if not db.query(Event).filter(Event.id == event_id).first():
        raise HTTPException(status_code=404, detail="Event not found")
    if max_cost and cost_per_attendee and cost_per_attendee > max_cost:
        raise HTTPException(status_code=400, detail=f"Cost per attendee cannot exceed max capping of {max_cost}")
    meal = EventMeal(event_id=event_id, meal_name=meal_name, max_cost=max_cost, cost_per_attendee=cost_per_attendee)
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return {"id": meal.id, "meal_name": meal.meal_name, "max_cost": float(meal.max_cost) if meal.max_cost else None, "cost_per_attendee": float(meal.cost_per_attendee) if meal.cost_per_attendee else None}


@router.delete("/{event_id}/meals/{meal_id}")
def remove_event_meal(event_id: int, meal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.event import EventMeal
    meal = db.query(EventMeal).filter(EventMeal.id == meal_id, EventMeal.event_id == event_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}


# Costs
@router.get("/{event_id}/costs", response_model=List[EventCostOut])
def list_costs(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(EventCost).filter(EventCost.event_id == event_id).all()


@router.post("/{event_id}/costs", response_model=EventCostOut)
def add_cost(event_id: int, data: EventCostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    cost = EventCost(**data.model_dump(), event_id=event_id)
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return cost


# Documents upload
@router.post("/{event_id}/documents")
async def upload_document(
    event_id: int,
    document_type: str = Form(...),
    stage: str = Form("pre"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not db.query(Event).filter(Event.id == event_id).first():
        raise HTTPException(status_code=404, detail="Event not found")

    # Validate file size (max 10MB)
    MAX_SIZE_BYTES = 10 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File must be under 10MB")

    file_ext = os.path.splitext(file.filename)[1]
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, str(event_id), file_name)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(contents)
    doc = EventDocument(
        event_id=event_id,
        document_type=document_type,
        document_name=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        stage=stage,
        uploaded_by_id=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "document_name": doc.document_name, "file_path": doc.file_path, "stage": doc.stage}


# Agreements (sub-module of Event)

class AgreementCreate(BaseModel):
    doctor_id: Optional[int] = None
    non_mcl_name: Optional[str] = None
    non_mcl_pan: Optional[str] = None
    non_mcl_email: Optional[str] = None
    is_hcp_doctor: bool = True
    agreement_date: Optional[datetime] = None


class AgreementOut(BaseModel):
    id: int
    event_id: int
    doctor_id: Optional[int] = None
    non_mcl_name: Optional[str] = None
    non_mcl_pan: Optional[str] = None
    non_mcl_email: Optional[str] = None
    is_hcp_doctor: bool
    agreement_date: Optional[datetime] = None
    status: str
    cancellation_remark: Optional[str] = None
    is_downloadable: bool
    doctor_name: Optional[str] = None
    doctor_pan: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/{event_id}/agreements")
def list_agreements(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    agreements = db.query(EventAgreement).filter(EventAgreement.event_id == event_id).all()
    result = []
    for ag in agreements:
        item = {
            "id": ag.id,
            "event_id": ag.event_id,
            "doctor_id": ag.doctor_id,
            "non_mcl_name": ag.non_mcl_name,
            "non_mcl_pan": ag.non_mcl_pan,
            "non_mcl_email": ag.non_mcl_email,
            "is_hcp_doctor": ag.is_hcp_doctor,
            "agreement_date": ag.agreement_date,
            "status": ag.status,
            "cancellation_remark": ag.cancellation_remark,
            "is_downloadable": ag.is_downloadable,
            "doctor_name": None,
            "doctor_pan": None,
        }
        if ag.doctor_id:
            doc = db.query(HcpDoctor).filter(HcpDoctor.id == ag.doctor_id).first()
            if doc:
                item["doctor_name"] = doc.full_name or f"{doc.first_name or ''} {doc.last_name or ''}".strip()
                item["doctor_pan"] = doc.pan_number
        result.append(item)
    return result


@router.post("/{event_id}/agreements")
def create_agreement(
    event_id: int,
    data: AgreementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not db.query(Event).filter(Event.id == event_id).first():
        raise HTTPException(status_code=404, detail="Event not found")
    ag = EventAgreement(
        event_id=event_id,
        doctor_id=data.doctor_id,
        non_mcl_name=data.non_mcl_name,
        non_mcl_pan=data.non_mcl_pan,
        non_mcl_email=data.non_mcl_email,
        is_hcp_doctor=data.is_hcp_doctor,
        agreement_date=data.agreement_date,
        status="Pending",
    )
    db.add(ag)
    db.commit()
    db.refresh(ag)
    return {"id": ag.id, "status": ag.status}


@router.put("/{event_id}/agreements/{agreement_id}/status")
def update_agreement_status(
    event_id: int,
    agreement_id: int,
    status: str,
    remark: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ag = db.query(EventAgreement).filter(
        EventAgreement.id == agreement_id,
        EventAgreement.event_id == event_id
    ).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agreement not found")
    ag.status = status
    if remark:
        ag.cancellation_remark = remark
    if status == "Approved":
        ag.is_downloadable = True
    db.commit()
    return {"id": ag.id, "status": ag.status}


@router.delete("/{event_id}/agreements/{agreement_id}")
def delete_agreement(
    event_id: int,
    agreement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ag = db.query(EventAgreement).filter(
        EventAgreement.id == agreement_id,
        EventAgreement.event_id == event_id
    ).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agreement not found")
    db.delete(ag)
    db.commit()
    return {"message": "Deleted"}
