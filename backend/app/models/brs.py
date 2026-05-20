from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class BrsStatus(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    DH_APPROVED = "DH Approved"
    DH_REJECTED = "DH Rejected"
    DOCTOR_PENDING = "Doctor Pending"
    COMPLETED = "Completed"
    VERIFIED = "Verified"


class BrsQuestionType(str, enum.Enum):
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    FREE_TEXT = "free_text"
    FILL_IN_BLANKS = "fill_in_blanks"


class BrsApplication(Base):
    """BRS (Bona Fide Research Survey) - created by Marketing Head, approved by Division Head"""
    __tablename__ = "brs_applications"

    id = Column(Integer, primary_key=True, index=True)
    brs_code = Column(String(50), unique=True, index=True)
    survey_id = Column(Integer, ForeignKey("brs_surveys.id"), nullable=True)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    title = Column(String(500))
    remarks = Column(Text)
    status = Column(String(50), default=BrsStatus.DRAFT)

    # Event-like fields
    therapeutic_area = Column(String(200))
    brand = Column(String(200))
    budget_type = Column(String(50))
    platform = Column(String(50))
    topic = Column(Text)
    on_field_execution_by = Column(String(200))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    city = Column(String(100))
    venue = Column(String(500))
    rationale = Column(Text)
    agenda = Column(Text)
    cost_center = Column(String(20))

    # Actors
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Marketing Head
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Division Head
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    survey = relationship("BrsSurvey", foreign_keys=[survey_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    doctors = relationship("BrsDoctor", back_populates="brs_application", cascade="all, delete-orphan")
    audit_trail = relationship("BrsAuditTrail", back_populates="application", order_by="BrsAuditTrail.created_at", cascade="all, delete-orphan")
    application_documents = relationship("BrsApplicationDocument", back_populates="application", cascade="all, delete-orphan")
    territory_assignments = relationship("BrsTerritoryAssignment", back_populates="application", cascade="all, delete-orphan")


class BrsDoctor(Base):
    """Doctors added to a BRS application - multiple per BRS"""
    __tablename__ = "brs_doctors"

    id = Column(Integer, primary_key=True, index=True)
    brs_application_id = Column(Integer, ForeignKey("brs_applications.id"), nullable=False)
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id"), nullable=True)  # From MCL

    # Editable by Marketing Head & Doctor
    doctor_name = Column(String(300), nullable=False)
    name_as_per_pan = Column(String(300))
    pan_number = Column(String(20))
    email = Column(String(200))
    mobile = Column(String(20))
    speciality = Column(String(200))
    honorarium_amount = Column(Numeric(12, 2))

    # Doctor login credentials (generated on DH approval)
    login_id = Column(String(100), unique=True, nullable=True)
    login_password = Column(String(200), nullable=True)  # hashed
    login_token = Column(String(200), unique=True, nullable=True)

    # Doctor self-service status
    details_updated_at = Column(DateTime, nullable=True)
    agreement_signed_at = Column(DateTime, nullable=True)
    agreement_signature = Column(Text)  # base64 signature image
    survey_completed_at = Column(DateTime, nullable=True)
    survey_responses = Column(JSON)

    # Status for this doctor entry
    doctor_status = Column(String(50), default="Pending")  # Pending, Details Updated, Agreement Signed, Survey Completed

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    brs_application = relationship("BrsApplication", back_populates="doctors")
    hcp_doctor = relationship("HcpDoctor")
    documents = relationship("BrsDoctorDocument", back_populates="doctor", cascade="all, delete-orphan")


class BrsDoctorDocument(Base):
    """Documents uploaded by doctor (PAN, Cheque, Letterhead, etc.)"""
    __tablename__ = "brs_doctor_documents"

    id = Column(Integer, primary_key=True, index=True)
    brs_doctor_id = Column(Integer, ForeignKey("brs_doctors.id"), nullable=False)
    document_type = Column(String(50), nullable=False)  # pan_copy, cancelled_cheque, letterhead, others
    document_name = Column(String(300))
    file_path = Column(String(500))
    mime_type = Column(String(100))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("BrsDoctor", back_populates="documents")


class BrsSurvey(Base):
    """Survey template - assigned to a division"""
    __tablename__ = "brs_surveys"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    total_honorarium_amount = Column(Numeric(12, 2))
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)  # Division-scoped
    is_active = Column(Boolean, default=True)
    requires_agreement_download = Column(Boolean, default=True)
    agreement_template = Column(Text)
    approval_status = Column(String(50), default="Pending Approval")  # Pending Approval, Approved
    medical_approval_file = Column(String(500), nullable=True)
    ethical_approval_file = Column(String(500), nullable=True)
    compliance_approval_file = Column(String(500), nullable=True)
    payment_method = Column(String(50), nullable=True)  # "Cheque" or "NEFT"
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by = relationship("User")
    questions = relationship("BrsSurveyQuestion", back_populates="survey",
                             order_by="BrsSurveyQuestion.order_no",
                             cascade="all, delete-orphan")
    doctor_mappings = relationship("SurveyDoctorMapping", back_populates="survey",
                                   cascade="all, delete-orphan")


class SurveyDoctorMapping(Base):
    """Maps doctors (from MCL) to a survey — only these doctors can be added to BRS using this survey"""
    __tablename__ = "survey_doctor_mappings"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("brs_surveys.id", ondelete="CASCADE"), nullable=False)
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    survey = relationship("BrsSurvey", back_populates="doctor_mappings")
    doctor = relationship("HcpDoctor")


class BrsSurveyQuestion(Base):
    __tablename__ = "brs_survey_questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("brs_surveys.id"), nullable=False)
    order_no = Column(Integer, default=1)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default=BrsQuestionType.FREE_TEXT)
    options = Column(JSON)
    is_required = Column(Boolean, default=True)
    min_duration_seconds = Column(Integer, default=0)
    video_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    survey = relationship("BrsSurvey", back_populates="questions")


class BrsAuditTrail(Base):
    __tablename__ = "brs_audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("brs_applications.id"), nullable=False)
    action = Column(String(200), nullable=False)
    from_status = Column(String(100))
    to_status = Column(String(100))
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("BrsApplication", back_populates="audit_trail")
    performed_by = relationship("User")


class BrsApplicationDocument(Base):
    """Documents uploaded by the initiator after BRS is completed"""
    __tablename__ = "brs_application_documents"

    id = Column(Integer, primary_key=True, index=True)
    brs_application_id = Column(Integer, ForeignKey("brs_applications.id", ondelete="CASCADE"), nullable=False)
    document_name = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100))
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("BrsApplication", back_populates="application_documents")
    uploaded_by = relationship("User")


class BrsTerritoryAssignment(Base):
    """Territory-wise user assignment for credential distribution"""
    __tablename__ = "brs_territory_assignments"

    id = Column(Integer, primary_key=True, index=True)
    brs_application_id = Column(Integer, ForeignKey("brs_applications.id", ondelete="CASCADE"), nullable=False)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)  # NULL = "No Territory" group
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_count = Column(Integer, default=0)
    email_status = Column(String(20), default="pending")  # pending, sent, failed
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("BrsApplication", back_populates="territory_assignments")
    territory = relationship("Territory")
    assigned_user = relationship("User")
