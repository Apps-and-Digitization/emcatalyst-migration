from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.base import get_db
from app.api.deps import get_current_active_user, require_admin
from app.models.user import User
from app.models.rbac import Role
from app.models.workflow import ApprovalWorkflow, ApprovalWorkflowStep

router = APIRouter(prefix="/workflows", tags=["Workflows"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class WorkflowOut(BaseModel):
    id: int
    workflow_key: str
    workflow_label: str
    description: Optional[str]
    is_active: bool
    steps: list = []


class StepCreate(BaseModel):
    step_order: int
    step_label: str
    approver_type: str  # "reporting_manager", "role", "specific_user"
    approver_role_id: Optional[int] = None
    approver_user_id: Optional[int] = None
    manager_level: Optional[int] = None
    pending_status: Optional[str] = None
    approved_status: Optional[str] = None
    can_skip: bool = False


class StepUpdate(BaseModel):
    step_order: Optional[int] = None
    step_label: Optional[str] = None
    approver_type: Optional[str] = None
    approver_role_id: Optional[int] = None
    approver_user_id: Optional[int] = None
    manager_level: Optional[int] = None
    pending_status: Optional[str] = None
    approved_status: Optional[str] = None
    can_skip: Optional[bool] = None
    is_active: Optional[bool] = None


class WorkflowStepsUpdate(BaseModel):
    """Bulk update all steps for a workflow"""
    steps: list[StepCreate]


# ─── Workflow Endpoints ───────────────────────────────────────────────────────

@router.get("/")
def list_workflows(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """List all approval workflows with their steps."""
    workflows = db.query(ApprovalWorkflow).order_by(ApprovalWorkflow.workflow_label).all()
    result = []
    for wf in workflows:
        steps = []
        for s in sorted(wf.steps, key=lambda x: x.step_order):
            role_name = None
            if s.approver_role_id:
                role = db.query(Role).filter(Role.id == s.approver_role_id).first()
                role_name = role.name if role else None
            user_name = None
            if s.approver_user_id:
                user = db.query(User).filter(User.id == s.approver_user_id).first()
                user_name = f"{user.first_name} {user.last_name}" if user else None
            steps.append({
                "id": s.id,
                "step_order": s.step_order,
                "step_label": s.step_label,
                "approver_type": s.approver_type,
                "approver_role_id": s.approver_role_id,
                "approver_role_name": role_name,
                "approver_user_id": s.approver_user_id,
                "approver_user_name": user_name,
                "manager_level": s.manager_level,
                "pending_status": s.pending_status,
                "approved_status": s.approved_status,
                "can_skip": s.can_skip,
                "is_active": s.is_active,
            })
        result.append({
            "id": wf.id,
            "workflow_key": wf.workflow_key,
            "workflow_label": wf.workflow_label,
            "description": wf.description,
            "is_active": wf.is_active,
            "initiator_role_id": wf.initiator_role_id,
            "initiator_role_name": wf.initiator_role.name if wf.initiator_role else None,
            "steps": steps,
        })
    return result


@router.get("/{workflow_id}")
def get_workflow(workflow_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    steps = []
    for s in sorted(wf.steps, key=lambda x: x.step_order):
        role_name = None
        if s.approver_role_id:
            role = db.query(Role).filter(Role.id == s.approver_role_id).first()
            role_name = role.name if role else None
        steps.append({
            "id": s.id,
            "step_order": s.step_order,
            "step_label": s.step_label,
            "approver_type": s.approver_type,
            "approver_role_id": s.approver_role_id,
            "approver_role_name": role_name,
            "approver_user_id": s.approver_user_id,
            "manager_level": s.manager_level,
            "pending_status": s.pending_status,
            "approved_status": s.approved_status,
            "can_skip": s.can_skip,
            "is_active": s.is_active,
        })
    return {
        "id": wf.id,
        "workflow_key": wf.workflow_key,
        "workflow_label": wf.workflow_label,
        "description": wf.description,
        "is_active": wf.is_active,
        "steps": steps,
    }


class WorkflowUpdate(BaseModel):
    initiator_role_id: Optional[int] = None


@router.put("/{workflow_id}")
def update_workflow(
    workflow_id: int,
    data: WorkflowUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Update workflow settings (e.g. initiator role)."""
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    if data.initiator_role_id is not None:
        wf.initiator_role_id = data.initiator_role_id if data.initiator_role_id > 0 else None
    db.commit()
    return {"message": "Workflow updated", "initiator_role_id": wf.initiator_role_id}


@router.put("/{workflow_id}/steps")
def update_workflow_steps(
    workflow_id: int,
    data: WorkflowStepsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Replace all steps for a workflow (bulk update)."""
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")

    # Delete existing steps
    db.query(ApprovalWorkflowStep).filter(ApprovalWorkflowStep.workflow_id == workflow_id).delete()
    db.flush()

    # Create new steps
    for step_data in data.steps:
        step = ApprovalWorkflowStep(
            workflow_id=workflow_id,
            step_order=step_data.step_order,
            step_label=step_data.step_label,
            approver_type=step_data.approver_type,
            approver_role_id=step_data.approver_role_id,
            approver_user_id=step_data.approver_user_id,
            manager_level=step_data.manager_level,
            pending_status=step_data.pending_status,
            approved_status=step_data.approved_status,
            can_skip=step_data.can_skip,
        )
        db.add(step)

    db.commit()
    return {"message": "Workflow steps updated", "step_count": len(data.steps)}


@router.post("/{workflow_id}/steps")
def add_step(
    workflow_id: int,
    data: StepCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Add a single step to a workflow."""
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")

    step = ApprovalWorkflowStep(
        workflow_id=workflow_id,
        step_order=data.step_order,
        step_label=data.step_label,
        approver_type=data.approver_type,
        approver_role_id=data.approver_role_id,
        approver_user_id=data.approver_user_id,
        manager_level=data.manager_level,
        pending_status=data.pending_status,
        approved_status=data.approved_status,
        can_skip=data.can_skip,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return {"id": step.id, "step_order": step.step_order, "step_label": step.step_label}


@router.delete("/{workflow_id}/steps/{step_id}")
def delete_step(
    workflow_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Remove a step from a workflow."""
    step = db.query(ApprovalWorkflowStep).filter(
        ApprovalWorkflowStep.id == step_id,
        ApprovalWorkflowStep.workflow_id == workflow_id,
    ).first()
    if not step:
        raise HTTPException(404, "Step not found")
    db.delete(step)
    db.commit()
    return {"message": "Step deleted"}



# ─── Generic can-approve check ────────────────────────────────────────────────

class CanApproveRequest(BaseModel):
    workflow_key: str
    current_status: str
    initiator_id: Optional[int] = None


@router.post("/can-approve")
def check_can_approve(
    data: CanApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Check if the current user can approve a record at the given status in the given workflow."""
    from app.services.workflow_service import get_step_for_status, can_user_approve_step

    step = get_step_for_status(db, data.workflow_key, data.current_status)
    if not step:
        return {"can_approve": False, "reason": "No workflow step found for this status"}

    can = can_user_approve_step(db, current_user, step, data.initiator_id)
    return {
        "can_approve": can,
        "step_label": step.step_label,
        "approver_type": step.approver_type,
    }


@router.get("/can-initiate/{workflow_key}")
def check_can_initiate(
    workflow_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Check if the current user can initiate/create records for this workflow."""
    from app.services.workflow_service import get_workflow, can_user_initiate

    wf = get_workflow(db, workflow_key)
    if not wf:
        return {"can_initiate": False, "reason": "Workflow not found"}

    can = can_user_initiate(db, current_user, wf)
    return {"can_initiate": can, "workflow_label": wf.workflow_label}
