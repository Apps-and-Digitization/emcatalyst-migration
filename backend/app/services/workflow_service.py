"""
Dynamic Approval Workflow Engine

Resolves the next approver for a given workflow step based on configuration.
"""
from sqlalchemy.orm import Session
from app.models.workflow import ApprovalWorkflow, ApprovalWorkflowStep
from app.models.rbac import Role
from app.models.user import User, UserRoleAssignment
from typing import Optional


# ─── Default workflow seeds ───────────────────────────────────────────────────

DEFAULT_WORKFLOWS = [
    {
        "workflow_key": "event_pre_approval",
        "workflow_label": "Event Pre-Approval",
        "description": "Approval chain for new events before execution",
    },
    {
        "workflow_key": "event_post_approval",
        "workflow_label": "Event Post-Approval",
        "description": "Approval chain for post-event documentation and finance",
    },
    {
        "workflow_key": "brs_approval",
        "workflow_label": "BRS Approval",
        "description": "Approval chain for BRS applications",
    },
    {
        "workflow_key": "invoice_approval",
        "workflow_label": "Invoice Approval",
        "description": "Approval chain for vendor invoices",
    },
]


def seed_workflows(db: Session) -> None:
    """Seed default workflows and steps if they don't exist."""
    for wf_data in DEFAULT_WORKFLOWS:
        existing = db.query(ApprovalWorkflow).filter(
            ApprovalWorkflow.workflow_key == wf_data["workflow_key"]
        ).first()
        if not existing:
            db.add(ApprovalWorkflow(**wf_data))
    db.commit()

    # Seed default steps for each workflow
    _seed_event_pre_steps(db)
    _seed_event_post_steps(db)
    _seed_brs_steps(db)
    _seed_invoice_steps(db)


def _seed_event_pre_steps(db: Session) -> None:
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.workflow_key == "event_pre_approval").first()
    if not wf or wf.steps:
        return
    steps = [
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=1, step_label="L1 Manager",
            approver_type="reporting_manager", manager_level=1,
            pending_status="Pending L1", approved_status="Pending L2",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=2, step_label="L2 Manager",
            approver_type="reporting_manager", manager_level=2,
            pending_status="Pending L2", approved_status="Pending Compliance",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=3, step_label="Compliance",
            approver_type="role", approver_role_id=_get_role_id(db, "Compliance User"),
            pending_status="Pending Compliance", approved_status="Pre-Approved",
        ),
    ]
    db.add_all(steps)
    db.commit()


def _seed_event_post_steps(db: Session) -> None:
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.workflow_key == "event_post_approval").first()
    if not wf or wf.steps:
        return
    steps = [
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=1, step_label="Post L1 Manager",
            approver_type="reporting_manager", manager_level=1,
            pending_status="Post L1", approved_status="Post L2",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=2, step_label="Post L2 Manager",
            approver_type="reporting_manager", manager_level=2,
            pending_status="Post L2", approved_status="Post Compliance",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=3, step_label="Post Compliance",
            approver_type="role", approver_role_id=_get_role_id(db, "Compliance User"),
            pending_status="Post Compliance", approved_status="Post Coordinator",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=4, step_label="Post Coordinator",
            approver_type="role", approver_role_id=_get_role_id(db, "User"),
            pending_status="Post Coordinator", approved_status="Post Finance",
            can_skip=True,
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=5, step_label="Post Finance",
            approver_type="role", approver_role_id=_get_role_id(db, "Finance User"),
            pending_status="Post Finance", approved_status="Completed",
        ),
    ]
    db.add_all(steps)
    db.commit()


def _seed_brs_steps(db: Session) -> None:
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.workflow_key == "brs_approval").first()
    if not wf or wf.steps:
        return
    steps = [
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=1, step_label="Division Head Approval",
            approver_type="role", approver_role_id=_get_role_id(db, "Division Head"),
            pending_status="Submitted", approved_status="Doctor Pending",
        ),
    ]
    db.add_all(steps)
    db.commit()


def _seed_invoice_steps(db: Session) -> None:
    wf = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.workflow_key == "invoice_approval").first()
    if not wf or wf.steps:
        return
    steps = [
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=1, step_label="Compliance Review",
            approver_type="role", approver_role_id=_get_role_id(db, "Compliance User"),
            pending_status="Pending", approved_status="Compliance Approved",
        ),
        ApprovalWorkflowStep(
            workflow_id=wf.id, step_order=2, step_label="Finance Approval",
            approver_type="role", approver_role_id=_get_role_id(db, "Finance User"),
            pending_status="Compliance Approved", approved_status="Finance Approved",
        ),
    ]
    db.add_all(steps)
    db.commit()


def _get_role_id(db: Session, role_name: str) -> Optional[int]:
    role = db.query(Role).filter(Role.name == role_name).first()
    return role.id if role else None


# ─── Workflow Engine ──────────────────────────────────────────────────────────

def get_workflow(db: Session, workflow_key: str) -> Optional[ApprovalWorkflow]:
    """Get a workflow by its key."""
    return db.query(ApprovalWorkflow).filter(
        ApprovalWorkflow.workflow_key == workflow_key,
        ApprovalWorkflow.is_active == True,
    ).first()


def get_workflow_steps(db: Session, workflow_key: str) -> list[ApprovalWorkflowStep]:
    """Get all active steps for a workflow, ordered by step_order."""
    wf = get_workflow(db, workflow_key)
    if not wf:
        return []
    return [s for s in wf.steps if s.is_active]


def get_step_for_status(db: Session, workflow_key: str, current_status: str) -> Optional[ApprovalWorkflowStep]:
    """Find the workflow step that corresponds to the current pending status."""
    steps = get_workflow_steps(db, workflow_key)
    for step in steps:
        if step.pending_status == current_status:
            return step
    return None


def get_next_step(db: Session, workflow_key: str, current_status: str) -> Optional[ApprovalWorkflowStep]:
    """Get the next step after the current status is approved."""
    steps = get_workflow_steps(db, workflow_key)
    for i, step in enumerate(steps):
        if step.pending_status == current_status:
            if i + 1 < len(steps):
                return steps[i + 1]
            return None  # Last step
    return None


def get_first_step(db: Session, workflow_key: str) -> Optional[ApprovalWorkflowStep]:
    """Get the first step of a workflow."""
    steps = get_workflow_steps(db, workflow_key)
    return steps[0] if steps else None


def resolve_approver(db: Session, step: ApprovalWorkflowStep, initiator: User) -> Optional[User]:
    """
    Resolve who should approve this step based on the step configuration.
    Returns the approver User or None if not resolvable.
    """
    if step.approver_type == "reporting_manager":
        return _resolve_manager(db, initiator, step.manager_level or 1)
    elif step.approver_type == "role":
        # For role-based steps, we don't resolve a specific user upfront
        # The approval endpoint checks if the current user has the required role
        return None
    elif step.approver_type == "specific_user":
        if step.approver_user_id:
            return db.query(User).filter(User.id == step.approver_user_id).first()
    return None


def can_user_approve_step(db: Session, user: User, step: ApprovalWorkflowStep, initiator_id: int = None) -> bool:
    """
    Check if a user is authorized to approve a given step.
    """
    if user.is_superuser:
        return True

    if step.approver_type == "reporting_manager":
        # Check if this user is the correct manager level for the initiator
        if not initiator_id:
            return False
        initiator = db.query(User).filter(User.id == initiator_id).first()
        if not initiator:
            return False
        expected_approver = _resolve_manager(db, initiator, step.manager_level or 1)
        return expected_approver and expected_approver.id == user.id

    elif step.approver_type == "role":
        if not step.approver_role_id:
            return False
        role = db.query(Role).filter(Role.id == step.approver_role_id).first()
        if not role:
            return False
        return _user_has_rbac_role(db, user, role.name)

    elif step.approver_type == "specific_user":
        return step.approver_user_id == user.id

    return False


def _resolve_manager(db: Session, user: User, level: int) -> Optional[User]:
    """Walk up the manager chain to the specified level."""
    current = user
    for _ in range(level):
        if not current.manager_id:
            return None
        current = db.query(User).filter(User.id == current.manager_id).first()
        if not current:
            return None
    return current


def _user_has_rbac_role(db: Session, user: User, role_name: str) -> bool:
    """Check if user has a given RBAC role (via primary role or assignments)."""
    # Check primary role
    if user.role == role_name:
        return True

    # Check additional role assignments
    if user.role_assignments:
        for ra in user.role_assignments:
            if ra.role == role_name:
                return True

    return False


def can_user_initiate(db: Session, user: User, workflow: ApprovalWorkflow) -> bool:
    """
    Check if a user can initiate/create records for this workflow.
    If no initiator_role_id is set, anyone can initiate.
    If set, only users with that role (primary or additional) can initiate.
    """
    if user.is_superuser:
        return True

    # If no initiator role configured, allow all
    if not workflow.initiator_role_id:
        return True

    # Check if user has the required role
    role = db.query(Role).filter(Role.id == workflow.initiator_role_id).first()
    if not role:
        return True  # Role deleted, allow all

    return _user_has_rbac_role(db, user, role.name)
