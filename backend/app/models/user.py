from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class UserRole(str, enum.Enum):
    """Legacy enum — kept for backward compatibility during migration.
    The role column is now a plain string referencing RBAC roles table."""
    ADMINISTRATOR = "Administrator"
    COMPLIANCE_USER = "ComplianceUser"
    DIVISION_COORDINATOR = "DivisionCoOrdinator"
    FINANCE_USER = "FinanceUser"
    GST_USER = "GSTuser"
    OPEX_USER = "OPEXUser"
    USER = "User"
    FUNCTIONAL_USER = "FunctionalUser"
    MY_ADMIN = "MyAdmin"
    ANONYMOUS = "Anonymous"
    MARKETING_HEAD = "MarketingHead"
    DIVISION_HEAD = "DivisionHead"


class Division(Base):
    __tablename__ = "divisions"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True, nullable=True)
    name = Column(String(200), nullable=False, unique=True)
    code = Column(String(20))
    cluster = Column(String(20))
    costcenter = Column(String(200))
    profitcenter = Column(String(200))
    eventcodeprefix = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="division")
    cost_centers = relationship("CostCenter", back_populates="division")


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id = Column(Integer, primary_key=True, index=True)
    cost_center_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    division_id = Column(Integer, ForeignKey("divisions.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    division = relationship("Division", back_populates="cost_centers")
    users = relationship("User", back_populates="cost_center")


class Function(Base):
    __tablename__ = "functions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20))
    is_active = Column(Boolean, default=True)


class Territory(Base):
    __tablename__ = "territories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20))
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    is_active = Column(Boolean, default=True)


class UserGroup(Base):
    __tablename__ = "user_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("User", secondary="user_group_members", back_populates="groups")


class UserGroupMember(Base):
    __tablename__ = "user_group_members"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    group_id = Column(Integer, ForeignKey("user_groups.id"), primary_key=True)


class UserRoleAssignment(Base):
    """Multiple roles per user"""
    __tablename__ = "user_role_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserDivisionAssignment(Base):
    """Multiple divisions per user (additional divisions beyond primary)"""
    __tablename__ = "user_division_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(200), index=True, nullable=True)
    hashed_password = Column(String(200), nullable=False)

    first_name = Column(String(100))
    middle_name = Column(String(100))
    last_name = Column(String(100))
    current_address = Column(Text)
    designation_title = Column(String(200))
    office_mobile_no = Column(String(20))
    personal_mobile_no = Column(String(20))
    date_of_joining = Column(DateTime)
    grade = Column(String(50))
    location = Column(String(200))
    region = Column(String(100))
    zone = Column(String(100))
    reporting_manager = Column(String(200))
    sap_user_id = Column(String(50))
    pan_number = Column(String(20))
    aadhar_number = Column(String(20))
    profile_image_url = Column(String(500))

    # Extended Emcure HR fields
    business_unit = Column(String(200))
    department = Column(String(200))
    group_company = Column(String(200))
    employee_status = Column(String(200))
    job_level = Column(String(200))
    direct_manager_employee_id = Column(String(200))
    direct_manager_email = Column(String(200))
    direct_manager_name = Column(String(200))
    office_location = Column(Text)
    office_state = Column(String(200))
    office_city = Column(String(200))
    territory_name = Column(Text)
    territory_code = Column(Text)
    gender = Column(String(6))
    date_of_birth = Column(String(200))
    extension_number = Column(String(200))
    mendix_id = Column(String(30), unique=True, nullable=True)

    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    cost_center_id = Column(Integer, ForeignKey("cost_centers.id"), nullable=True)
    function_id = Column(Integer, ForeignKey("functions.id"), nullable=True)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    role = Column(String(100), default="User")
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    division = relationship("Division", back_populates="users")
    cost_center = relationship("CostCenter", back_populates="users")
    groups = relationship("UserGroup", secondary="user_group_members", back_populates="members")
    events_initiated = relationship("Event", foreign_keys="Event.initiator_id", back_populates="initiator")
    manager = relationship("User", foreign_keys=[manager_id], remote_side="User.id", backref="direct_reports")
    role_assignments = relationship("UserRoleAssignment", backref="user", lazy="joined")
    division_assignments = relationship("UserDivisionAssignment", backref="user", lazy="joined")
