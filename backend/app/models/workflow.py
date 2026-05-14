from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ApprovalWorkflow(Base):
    """Defines a configurable approval workflow (e.g. event_pre_approval, brs_approval)"""
    __tablename__ = "approval_workflows"

    id = Column(Integer, primary_key=True, index=True)
    workflow_key = Column(String(100), unique=True, nullable=False, index=True)
    workflow_label = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Who can initiate/create records for this workflow
    initiator_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    steps = relationship(
        "ApprovalWorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="ApprovalWorkflowStep.step_order",
    )
    initiator_role = relationship("Role", foreign_keys=[initiator_role_id])


class ApprovalWorkflowStep(Base):
    """A single step in an approval workflow"""
    __tablename__ = "approval_workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("approval_workflows.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    step_label = Column(String(200), nullable=False)

    # How to resolve the approver
    # "reporting_manager" - use initiator's manager chain (L1, L2, etc.)
    # "role" - anyone with this RBAC role can approve
    # "specific_user" - a fixed user
    approver_type = Column(String(50), nullable=False)

    # Used when approver_type = "role"
    approver_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    # Used when approver_type = "specific_user"
    approver_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # For reporting_manager: which level (1=L1, 2=L2, etc.)
    manager_level = Column(Integer, nullable=True, default=1)

    # The status the record transitions to when this step is reached
    pending_status = Column(String(100), nullable=True)

    # The status the record transitions to after this step is approved
    approved_status = Column(String(100), nullable=True)

    can_skip = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workflow = relationship("ApprovalWorkflow", back_populates="steps")
    approver_role = relationship("Role", foreign_keys=[approver_role_id])
    approver_user = relationship("User", foreign_keys=[approver_user_id])
