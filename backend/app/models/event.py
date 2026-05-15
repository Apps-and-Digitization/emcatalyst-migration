from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class EventType(str, enum.Enum):
    CME = "CME / RTM"
    ADVISORY_BOARD = "Advisory Board"
    CORPORATE_SPONSORSHIP = "Corporate Sponsorship"


class EventStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING_L1 = "Pending L1"
    PENDING_L2 = "Pending L2"
    PENDING_COMPLIANCE = "Pending Compliance"
    PRE_APPROVED = "Pre-Approved"
    POST_EVENT_PENDING = "Post-Event Pending"
    POST_L1 = "Post L1"
    POST_L2 = "Post L2"
    POST_COMPLIANCE = "Post Compliance"
    POST_COORDINATOR = "Post Coordinator"
    POST_GST = "Post GST"
    POST_FINANCE = "Post Finance"
    COMPLETED = "Completed"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(50), unique=True, index=True)
    event_title = Column(String(500), nullable=False)
    event_type = Column(String(100))  # CME / RTM, Advisory Board, Corporate Sponsorship
    event_category = Column(String(100))

    # Common fields
    therapeutic_area = Column(Text)  # JSON array or comma-separated
    brand = Column(String(200))
    budget_type = Column(String(50))  # Head Office / Field / Both
    on_field_execution_by = Column(String(200))
    platform = Column(String(50))  # In Person / Virtual / Both
    topic = Column(String(500))
    event_date = Column(DateTime)
    event_end_date = Column(DateTime)
    city = Column(String(100))
    venue = Column(String(500))
    rationale = Column(Text)
    promotional_material_approved = Column(String(10))  # Yes / No
    agenda = Column(Text)
    proposed_emcure_attendees = Column(Integer)
    num_hcps_professional_services = Column(Integer)
    proposed_num_hcps = Column(Integer)

    # Corporate Sponsorship specific
    conference_type = Column(String(50))  # NCON / RCON / Local
    solicited_unsolicited = Column(String(50))
    sponsorship_type = Column(Text)  # JSON: Stall, Scientific Session, etc.
    sponsorship_amount = Column(Numeric(15, 2))
    advance_payment = Column(Boolean, default=False)
    advance_payment_reason = Column(Text)
    advance_payment_amount = Column(Numeric(15, 2))
    is_division_involved = Column(Boolean, default=False)

    # Cost fields
    meal_type = Column(String(100))  # Breakfast/Hi-tea, Lunch/Dinner
    meal_cost_per_attendee = Column(Numeric(12, 2))
    total_meal_cost = Column(Numeric(12, 2))
    minimum_guarantee_pax = Column(Integer)
    venue_charges = Column(Numeric(12, 2))
    av_platform_cost = Column(Numeric(12, 2))
    other_amount = Column(Numeric(12, 2))
    other_amount_description = Column(Text)
    total_event_cost = Column(Numeric(15, 2))
    btc_facility = Column(String(10))  # Yes / No

    # Existing fields
    state = Column(String(100))
    country = Column(String(100), default="India")
    expected_attendance = Column(Integer)
    actual_attendance = Column(Integer)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    company_code = Column(String(10))
    cost_center = Column(String(20))
    budget_amount = Column(Numeric(15, 2))
    actual_amount = Column(Numeric(15, 2))
    status = Column(String(50), default=EventStatus.DRAFT)
    initiator_id = Column(Integer, ForeignKey("users.id"))
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    l1_approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    l2_approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    l1_approved_at = Column(DateTime, nullable=True)
    l2_approved_at = Column(DateTime, nullable=True)
    compliance_approved_at = Column(DateTime, nullable=True)
    compliance_remarks = Column(Text)
    finance_remarks = Column(Text)
    rejection_reason = Column(Text)
    step = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    initiator = relationship("User", foreign_keys=[initiator_id], back_populates="events_initiated")
    approver = relationship("User", foreign_keys=[approver_id])
    l1_approver = relationship("User", foreign_keys=[l1_approver_id])
    l2_approver = relationship("User", foreign_keys=[l2_approver_id])
    doctors = relationship("EventDoctor", back_populates="event")
    costs = relationship("EventCost", back_populates="event")
    documents = relationship("EventDocument", back_populates="event")
    honorariums = relationship("EventHonorarium", back_populates="event")
    institutions = relationship("EventInstitution", back_populates="event")
    agreements = relationship("EventAgreement", back_populates="event")
    audit_trail = relationship("EventAuditTrail", back_populates="event", order_by="EventAuditTrail.created_at")
    meals = relationship("EventMeal", back_populates="event")


class EventDoctor(Base):
    __tablename__ = "event_doctors"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id"), nullable=True)  # FK to MCL
    is_mcl = Column(Boolean, default=True)
    doctor_name = Column(String(300), nullable=False)
    name_as_per_pan = Column(String(300))
    qualification = Column(String(200))
    specialization = Column(String(200))
    institute = Column(String(300))
    city = Column(String(100))
    mobile_no = Column(String(20))
    email = Column(String(200))
    pan_number = Column(String(20))
    gstin = Column(String(20))
    role = Column(String(100))  # Speaker, Chairperson, Moderator, Panellist, Advisor, Consultant, Others
    bank_name = Column(String(200))
    bank_account_no = Column(String(30))
    ifsc_code = Column(String(20))
    years_of_experience = Column(Integer)
    occupational_address = Column(Text)
    planned_unplanned = Column(String(20))  # Planned / Unplanned / Deviation

    # FMV Parameters (per event per doctor)
    fmv_expertise = Column(String(50))  # Super-specialty / Specialty / General Practitioners
    fmv_clinical_experience = Column(String(100))  # >15 yrs / 11-15 / 5-10 / <=5
    fmv_publications = Column(String(100))  # >25 / 10-25 / <10 / None
    fmv_congress_experience = Column(String(100))  # International / National / State / None
    fmv_professional_position = Column(String(100))  # Sr Consultant / Consultant >15 / <15 / Non-physician
    fmv_investigator_experience = Column(String(100))  # PI 2+ trials / Clinical trial exp / None
    fmv_total_points = Column(Integer)
    fmv_category = Column(String(10))  # Cat A / Cat B / Cat C
    fmv_hourly_rate = Column(Numeric(12, 2))  # Derived hourly rate
    fmv_max_capping = Column(Numeric(12, 2))  # Max capping
    derived_honorarium = Column(Numeric(12, 2))  # Calculated derived honorarium
    honorarium = Column(Numeric(12, 2))  # Actual honorarium (must be <= derived)
    fmv_amount = Column(Numeric(12, 2))  # Legacy field

    # Cost fields (per event per doctor)
    cab_cost = Column(Numeric(12, 2))
    accommodation_cost = Column(Numeric(12, 2))
    flight_cost = Column(Numeric(12, 2))
    remark = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="doctors")


class EventInstitution(Base):
    __tablename__ = "event_institutions"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    institution_name = Column(String(300))
    contact_person = Column(String(200))
    mobile_no = Column(String(20))
    email = Column(String(200))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    gstin = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="institutions")


class EventCost(Base):
    __tablename__ = "event_costs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    cost_head = Column(String(200), nullable=False)
    cost_category = Column(String(100))
    vendor_name = Column(String(300))
    estimated_amount = Column(Numeric(12, 2))
    actual_amount = Column(Numeric(12, 2))
    currency = Column(String(10), default="INR")
    gst_applicable = Column(Boolean, default=False)
    gst_rate = Column(Numeric(5, 2))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="costs")


class EventDocument(Base):
    __tablename__ = "event_documents"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    document_type = Column(String(100))
    document_name = Column(String(300))
    file_path = Column(String(500))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    stage = Column(String(10), default="pre")  # "pre" or "post"
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="documents")
    uploaded_by = relationship("User")


class EventHonorarium(Base):
    __tablename__ = "event_honorariums"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("event_doctors.id"), nullable=True)
    doctor_name = Column(String(300))
    session_type = Column(String(100))
    duration_minutes = Column(Integer)
    fmv_per_hour = Column(Numeric(10, 2))
    honorarium_amount = Column(Numeric(12, 2))
    tds_applicable = Column(Boolean, default=True)
    tds_rate = Column(Numeric(5, 2))
    tds_amount = Column(Numeric(12, 2))
    net_payable = Column(Numeric(12, 2))
    payment_status = Column(String(50), default="Pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="honorariums")
    doctor = relationship("EventDoctor")


class EventDocumentType(Base):
    __tablename__ = "event_document_types"

    id = Column(Integer, primary_key=True)
    event_type = Column(String(100))
    document_name = Column(String(200), nullable=False)
    is_mandatory = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class EventAgreement(Base):
    __tablename__ = "event_agreements"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True, nullable=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("hcp_doctors.id"), nullable=True)
    non_mcl_name = Column(String(300))
    non_mcl_pan = Column(String(20))
    non_mcl_email = Column(String(200))
    is_hcp_doctor = Column(Boolean, default=True)
    agreement_date = Column(DateTime)
    status = Column(String(50), default="Pending")
    cancellation_remark = Column(Text)
    is_downloadable = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("Event", back_populates="agreements")
    doctor = relationship("HcpDoctor")


class EventMeal(Base):
    __tablename__ = "event_meals"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    meal_name = Column(String(200), nullable=False)
    max_cost = Column(Numeric(12, 2))  # From master
    cost_per_attendee = Column(Numeric(12, 2))  # Actual cost entered by user
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="meals")


class EventAuditTrail(Base):
    __tablename__ = "event_audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    action = Column(String(100), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="audit_trail")
    performed_by = relationship("User")
