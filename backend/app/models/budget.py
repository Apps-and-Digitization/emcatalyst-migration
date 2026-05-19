from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class MasterBudget(Base):
    __tablename__ = "master_budgets"

    id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=False)
    budget_type = Column(String(50), nullable=False)  # "Sponsorship/Event Cost" or "Speaker Cost"
    budget_month = Column(DateTime, nullable=True)  # Stores first day of month (e.g. 2026-05-01)
    month = Column(Integer, nullable=True)  # Legacy
    year = Column(Integer, nullable=True)  # Legacy
    allocated_budget = Column(Numeric(14, 2), nullable=False)
    utilized_budget = Column(Numeric(14, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    division = relationship("Division")


class BudgetAuditTrail(Base):
    __tablename__ = "budget_audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey("master_budgets.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "Created", "Updated", "Deducted", "Reversed"
    amount = Column(Numeric(14, 2))
    description = Column(Text)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    budget = relationship("MasterBudget")
    performed_by = relationship("User")


class BrsBudget(Base):
    """BRS Budget - division-wise, quarter-wise allocation"""
    __tablename__ = "brs_budgets"

    id = Column(Integer, primary_key=True, index=True)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=False)
    quarter = Column(Integer, nullable=False)  # 1, 2, 3, 4
    year = Column(Integer, nullable=False)  # e.g. 2026
    allocated_budget = Column(Numeric(14, 2), nullable=False)
    utilized_budget = Column(Numeric(14, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    division = relationship("Division")
    audit_trail = relationship("BrsBudgetAuditTrail", back_populates="budget", order_by="BrsBudgetAuditTrail.created_at")


class BrsBudgetAuditTrail(Base):
    """Audit trail for BRS budget changes"""
    __tablename__ = "brs_budget_audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey("brs_budgets.id"), nullable=False)
    action = Column(String(50), nullable=False)
    amount = Column(Numeric(14, 2))
    description = Column(Text)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    brs_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    budget = relationship("BrsBudget", back_populates="audit_trail")
    performed_by = relationship("User")
