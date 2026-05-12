from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class BrsStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING_L1 = "Pending L1"
    PENDING_L2 = "Pending L2"
    PENDING_COMPLIANCE = "Pending Compliance"
    PENDING_HCP_FORM = "Pending HCP Form"
    PENDING_SURVEY = "Pending Survey"
    PENDING_SIGN = "Pending Sign"
    SURVEY_COMPLETED = "Survey Completed"
    PENDING_COORD_VERIFICATION = "Pending Coord. Verification"
    PENDING_VENDOR_CREATION = "Pending Vendor Creation"
    PENDING_FINANCE = "Pending Finance"
    POSTED = "Posted"
    PAID = "Paid"


class BrsQuestionType(str, enum.Enum):
    DROPDOWN = "dropdown"
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    FREE_TEXT = "free_text"
    VIDEO = "video"


class BrsApplication(Base):
    __tablename__ = "brs_applications"

    id = Column(Integer, primary_key=True, index=True)
    brs_code = Column(String(50), unique=True, index=True)
    survey_title = Column(String(500), nullable=False)
    therapeutic_area = Column(String(200))
    brand = Column(String(200))
    topic = Column(Text)
    mode = Column(String(20), default="Online")
    survey_duration_minutes = Column(Integer, default=30)
    honorarium_amount = Column(Numeric(12, 2))
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    cost_center = Column(String(20))
    company_code = Column(String(10))
    remarks = Column(Text)
    status = Column(Enum(BrsStatus), default=BrsStatus.DRAFT)

    # HCP / Doctor
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id"), nullable=True)
    is_new_doctor = Column(Boolean, default=False)
    new_doctor_name = Column(String(300))
    new_doctor_email = Column(String(200))
    new_doctor_phone = Column(String(20))
    new_doctor_speciality = Column(String(200))
    new_doctor_city = Column(String(100))
    pan_number = Column(String(20))
    bank_name = Column(String(200))
    bank_account_no = Column(String(50))
    ifsc_code = Column(String(20))

    # Survey link (tokenized doctor portal)
    survey_token = Column(String(100), unique=True, index=True)
    survey_link_sent_at = Column(DateTime)
    hcp_form_submitted_at = Column(DateTime)
    survey_started_at = Column(DateTime)
    survey_completed_at = Column(DateTime)
    survey_responses = Column(JSON)

    # Agreement & signature
    agreement_sent_at = Column(DateTime)
    agreement_signed_at = Column(DateTime)
    signature_image_path = Column(String(500))
    signature_otp_verified = Column(Boolean, default=False)

    # Vendor
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor_lookup_scenario = Column(Integer)
    vendor_creation_notified_at = Column(DateTime)

    # Workflow timestamps & actors
    initiator_id = Column(Integer, ForeignKey("users.id"))
    l1_approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    l2_approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    compliance_approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    l1_approved_at = Column(DateTime)
    l2_approved_at = Column(DateTime)
    compliance_approved_at = Column(DateTime)
    coord_verified_at = Column(DateTime)
    finance_posted_at = Column(DateTime)
    paid_at = Column(DateTime)
    rejection_reason = Column(Text)

    pan_document_path = Column(String(500))

    # Survey assignment
    survey_id = Column(Integer, ForeignKey("brs_surveys.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    initiator = relationship("User", foreign_keys=[initiator_id])
    l1_approver = relationship("User", foreign_keys=[l1_approver_id])
    l2_approver = relationship("User", foreign_keys=[l2_approver_id])
    compliance_approver = relationship("User", foreign_keys=[compliance_approver_id])
    hcp_doctor = relationship("HcpDoctor")
    vendor = relationship("Vendor")
    survey = relationship("BrsSurvey", foreign_keys=[survey_id])
    audit_trail = relationship("BrsAuditTrail", back_populates="application",
                               order_by="BrsAuditTrail.created_at", cascade="all, delete-orphan")
    otp_records = relationship("BrsOtp", back_populates="application", cascade="all, delete-orphan")


class BrsSurvey(Base):
    __tablename__ = "brs_surveys"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    honorarium_upper_limit = Column(Numeric(12, 2))
    is_active = Column(Boolean, default=True)
    requires_agreement_download = Column(Boolean, default=True)
    agreement_template = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by = relationship("User")
    questions = relationship("BrsSurveyQuestion", back_populates="survey",
                             order_by="BrsSurveyQuestion.order_no",
                             cascade="all, delete-orphan")


class BrsSurveyQuestion(Base):
    __tablename__ = "brs_survey_questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("brs_surveys.id"), nullable=False)
    order_no = Column(Integer, default=1)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(BrsQuestionType), default=BrsQuestionType.FREE_TEXT)
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


class BrsOtp(Base):
    __tablename__ = "brs_otps"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("brs_applications.id"), nullable=False)
    otp_code = Column(String(10), nullable=False)
    mobile = Column(String(20))
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("BrsApplication", back_populates="otp_records")
