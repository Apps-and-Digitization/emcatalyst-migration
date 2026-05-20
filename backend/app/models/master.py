from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class CompanyCode(Base):
    __tablename__ = "company_codes"

    id = Column(Integer, primary_key=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(200))
    country = Column(String(10))
    currency = Column(String(10))
    is_active = Column(Boolean, default=True)


class MasterDivision(Base):
    __tablename__ = "master_divisions"

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)


class Designation(Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), unique=True, nullable=False)
    grade = Column(String(20))
    is_active = Column(Boolean, default=True)


class EventType(Base):
    __tablename__ = "event_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    max_fmv = Column(Integer)
    is_active = Column(Boolean, default=True)


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True)
    name = Column(String(200), nullable=False)
    event_type_code = Column(String(100), nullable=True)  # links to EventType.code, NULL = all types
    stage = Column(String(10), default="pre")  # "pre" or "post"
    is_mandatory = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class Enumeration(Base):
    __tablename__ = "enumerations"

    id = Column(Integer, primary_key=True)
    category = Column(String(100), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    label = Column(String(200), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class HcpDoctorDivision(Base):
    """Many-to-many: Doctor belongs to multiple divisions"""
    __tablename__ = "hcp_doctor_divisions"

    id = Column(Integer, primary_key=True, index=True)
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id", ondelete="CASCADE"), nullable=False)
    division_id = Column(Integer, ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False)


class HcpDoctorTerritory(Base):
    """Many-to-many: Doctor belongs to multiple territories"""
    __tablename__ = "hcp_doctor_territories"

    id = Column(Integer, primary_key=True, index=True)
    hcp_doctor_id = Column(Integer, ForeignKey("hcp_doctors.id", ondelete="CASCADE"), nullable=False)
    territory_id = Column(Integer, ForeignKey("territories.id", ondelete="CASCADE"), nullable=False)


class HcpDoctor(Base):
    __tablename__ = "hcp_doctors"

    id = Column(Integer, primary_key=True, index=True)
    # MCL fields from Excel template
    division = Column(String(200))  # Text field from import (for display/search)
    territory_name = Column(String(200))
    employee_code = Column(String(50))
    first_name = Column(String(200))
    middle_name = Column(String(200))
    last_name = Column(String(200))
    full_name = Column(String(200))
    uid_number = Column(String(200), index=True, unique=True)
    sbu_code = Column(String(200))
    gender = Column(String(10))
    doctor_type = Column(String(100))
    qualification = Column(String(200))
    speciality = Column(String(200))
    city = Column(String(200))
    state = Column(String(50))
    town_name = Column(String(200))
    birthday = Column(String(50))
    service_preference = Column(String(200))
    area_of_practice = Column(String(200))
    mobile_number = Column(String(20))
    email = Column(String(200))
    # Used in Events (FMV) and BRS
    pan_number = Column(String(200))
    hourly_rate = Column(Numeric(12, 2))
    max_capping = Column(Numeric(12, 2))
    # System fields
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Many-to-many with divisions
    divisions = relationship("Division", secondary="hcp_doctor_divisions", backref="hcp_doctors")
    # Many-to-many with territories
    territories = relationship("Territory", secondary="hcp_doctor_territories", backref="hcp_doctors")


class FmvCriteria(Base):
    __tablename__ = "fmv_criteria"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    clinical_practice_experience = Column(String(34))
    investigator_experience = Column(String(50))
    expertise = Column(String(21))
    professional_position = Column(String(75))
    congress_experience = Column(String(101))
    publications = Column(String(78))
    is_active = Column(Boolean, default=True)


class FmvParameter(Base):
    """FMV Parameter master - stores each parameter with its options and points"""
    __tablename__ = "fmv_parameters"

    id = Column(Integer, primary_key=True, index=True)
    parameter_name = Column(String(100), nullable=False)  # e.g. "Clinical Practice Experience"
    option_label = Column(String(200), nullable=False)  # e.g. "More than 15 Years post graduation"
    option_code = Column(String(5))  # A, B, C, D
    points = Column(Integer, nullable=False)  # 1-4
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class MasterSpeciality(Base):
    __tablename__ = "master_specialities"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)


class MasterHcpRole(Base):
    __tablename__ = "master_hcp_roles"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(40), nullable=False)
    is_active = Column(Boolean, default=True)


class MasterTherapeutic(Base):
    __tablename__ = "master_therapeutics"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(40), nullable=False)
    is_active = Column(Boolean, default=True)


class MasterState(Base):
    __tablename__ = "master_states"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)


class BrandDivision(Base):
    """Many-to-many: Brand belongs to multiple divisions"""
    __tablename__ = "brand_divisions"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("master_brands.id", ondelete="CASCADE"), nullable=False)
    division_id = Column(Integer, ForeignKey("divisions.id", ondelete="CASCADE"), nullable=False)


class MasterBrand(Base):
    __tablename__ = "master_brands"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(200), nullable=False)
    therapeutic_area = Column(String(200))  # Legacy field - kept in DB but not used
    is_active = Column(Boolean, default=True)

    # Many-to-many with divisions
    divisions = relationship("Division", secondary="brand_divisions")


class MasterMeal(Base):
    __tablename__ = "master_meals"

    id = Column(Integer, primary_key=True, index=True)
    mendix_id = Column(String(30), unique=True)
    name = Column(String(200), nullable=False)
    max_cost = Column(Numeric(12, 2), nullable=True)  # Max capping per attendee
    is_active = Column(Boolean, default=True)


class MasterCity(Base):
    __tablename__ = "master_cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    state = Column(String(200))
    is_active = Column(Boolean, default=True)


class MasterSponsorshipType(Base):
    __tablename__ = "master_sponsorship_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)



