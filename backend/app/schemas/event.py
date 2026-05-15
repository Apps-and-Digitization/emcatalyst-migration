from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.event import EventStatus


class EventDoctorBase(BaseModel):
    doctor_name: str
    name_as_per_pan: Optional[str] = None
    qualification: Optional[str] = None
    specialization: Optional[str] = None
    institute: Optional[str] = None
    city: Optional[str] = None
    mobile_no: Optional[str] = None
    email: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    role: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    fmv_amount: Optional[Decimal] = None
    is_mcl: Optional[bool] = True
    # FMV parameters
    fmv_expertise: Optional[str] = None
    fmv_clinical_experience: Optional[str] = None
    fmv_publications: Optional[str] = None
    fmv_congress_experience: Optional[str] = None
    fmv_professional_position: Optional[str] = None
    fmv_investigator_experience: Optional[str] = None
    fmv_total_points: Optional[int] = None
    fmv_category: Optional[str] = None
    fmv_hourly_rate: Optional[Decimal] = None
    fmv_max_capping: Optional[Decimal] = None
    derived_honorarium: Optional[Decimal] = None
    honorarium: Optional[Decimal] = None
    # Costs
    cab_cost: Optional[Decimal] = None
    accommodation_cost: Optional[Decimal] = None
    flight_cost: Optional[Decimal] = None
    remark: Optional[str] = None


class EventDoctorCreate(EventDoctorBase):
    pass


class EventDoctorOut(EventDoctorBase):
    id: int
    event_id: int
    is_mcl: Optional[bool] = True
    created_at: datetime

    class Config:
        from_attributes = True


class EventCostBase(BaseModel):
    cost_head: str
    cost_category: Optional[str] = None
    vendor_name: Optional[str] = None
    estimated_amount: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    currency: str = "INR"
    gst_applicable: bool = False
    gst_rate: Optional[Decimal] = None
    remarks: Optional[str] = None


class EventCostCreate(EventCostBase):
    pass


class EventCostOut(EventCostBase):
    id: int
    event_id: int

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    event_title: str
    event_type: Optional[str] = None
    event_category: Optional[str] = None
    therapeutic_area: Optional[str] = None
    brand: Optional[str] = None
    budget_type: Optional[str] = None
    on_field_execution_by: Optional[str] = None
    platform: Optional[str] = None
    topic: Optional[str] = None
    event_date: Optional[datetime] = None
    event_end_date: Optional[datetime] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    rationale: Optional[str] = None
    promotional_material_approved: Optional[str] = None
    agenda: Optional[str] = None
    proposed_emcure_attendees: Optional[int] = None
    num_hcps_professional_services: Optional[int] = None
    proposed_num_hcps: Optional[int] = None
    # Corporate Sponsorship specific
    conference_type: Optional[str] = None
    solicited_unsolicited: Optional[str] = None
    sponsorship_type: Optional[str] = None
    sponsorship_amount: Optional[Decimal] = None
    advance_payment: Optional[bool] = None
    advance_payment_reason: Optional[str] = None
    advance_payment_amount: Optional[Decimal] = None
    is_division_involved: Optional[bool] = None
    # Existing
    expected_attendance: Optional[int] = None
    division_id: Optional[int] = None
    company_code: Optional[str] = None
    cost_center: Optional[str] = None
    budget_amount: Optional[Decimal] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    event_title: Optional[str] = None
    event_type: Optional[str] = None
    event_category: Optional[str] = None
    therapeutic_area: Optional[str] = None
    brand: Optional[str] = None
    budget_type: Optional[str] = None
    on_field_execution_by: Optional[str] = None
    platform: Optional[str] = None
    topic: Optional[str] = None
    event_date: Optional[datetime] = None
    event_end_date: Optional[datetime] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    rationale: Optional[str] = None
    promotional_material_approved: Optional[str] = None
    agenda: Optional[str] = None
    proposed_emcure_attendees: Optional[int] = None
    num_hcps_professional_services: Optional[int] = None
    proposed_num_hcps: Optional[int] = None
    # Corporate Sponsorship
    conference_type: Optional[str] = None
    solicited_unsolicited: Optional[str] = None
    sponsorship_type: Optional[str] = None
    sponsorship_amount: Optional[Decimal] = None
    advance_payment: Optional[bool] = None
    advance_payment_reason: Optional[str] = None
    advance_payment_amount: Optional[Decimal] = None
    is_division_involved: Optional[bool] = None
    # Costs
    meal_type: Optional[str] = None
    meal_cost_per_attendee: Optional[Decimal] = None
    minimum_guarantee_pax: Optional[int] = None
    venue_charges: Optional[Decimal] = None
    av_platform_cost: Optional[Decimal] = None
    other_amount: Optional[Decimal] = None
    other_amount_description: Optional[str] = None
    btc_facility: Optional[str] = None
    # Existing
    expected_attendance: Optional[int] = None
    division_id: Optional[int] = None
    budget_amount: Optional[Decimal] = None
    cost_center: Optional[str] = None
    status: Optional[str] = None
    compliance_remarks: Optional[str] = None
    finance_remarks: Optional[str] = None
    rejection_reason: Optional[str] = None
    step: Optional[int] = None


class EventMealOut(BaseModel):
    id: int
    meal_name: str
    max_cost: Optional[Decimal] = None
    cost_per_attendee: Optional[Decimal] = None

    class Config:
        from_attributes = True


class EventDocumentOut(BaseModel):
    id: int
    event_id: int
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    file_path: Optional[str] = None
    mime_type: Optional[str] = None
    stage: Optional[str] = "pre"
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EventOut(EventBase):
    id: int
    event_code: Optional[str]
    status: str
    initiator_id: int
    l1_approver_id: Optional[int] = None
    l2_approver_id: Optional[int] = None
    l1_approved_at: Optional[datetime] = None
    l2_approved_at: Optional[datetime] = None
    compliance_approved_at: Optional[datetime] = None
    approver_id: Optional[int] = None
    compliance_remarks: Optional[str] = None
    rejection_reason: Optional[str] = None
    step: int
    actual_amount: Optional[Decimal]
    # Cost fields
    venue_charges: Optional[Decimal] = None
    av_platform_cost: Optional[Decimal] = None
    other_amount: Optional[Decimal] = None
    other_amount_description: Optional[str] = None
    btc_facility: Optional[str] = None
    minimum_guarantee_pax: Optional[int] = None
    meal_cost_per_attendee: Optional[Decimal] = None
    meal_type: Optional[str] = None
    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]
    doctors: List[EventDoctorOut] = []
    costs: List[EventCostOut] = []
    documents: List[EventDocumentOut] = []
    meals: List[EventMealOut] = []

    class Config:
        from_attributes = True
