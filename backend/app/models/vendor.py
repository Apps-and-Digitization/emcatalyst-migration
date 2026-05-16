from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    lifnr = Column(String(20), index=True)  # Vendor number
    bukrs = Column(String(10))  # Company code
    zterm = Column(String(10))  # Payment terms
    erdat = Column(String(20))  # Created date (SAP)
    ernam = Column(String(50))  # Created by (SAP)
    name = Column(String(300), nullable=False)
    region = Column(String(100))
    state = Column(String(100))
    pan_number = Column(String(20))
    bankl = Column(String(50))  # Bank key
    bankn = Column(String(50))  # Bank account number
    payment_method = Column(String(100))
    payment_block = Column(String(200))
    block_desc = Column(String(500))
    gst_number = Column(String(30))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    withholding_taxes = relationship("WithHoldingTax", secondary="vendor_withholding_tax_link", back_populates="vendors")


class WithHoldingTax(Base):
    """Standalone withholding tax master"""
    __tablename__ = "vendor_withholding_taxes"

    id = Column(Integer, primary_key=True, index=True)
    tax_code = Column(String(20))
    name = Column(String(200))
    section = Column(String(100))
    rate = Column(String(20))
    with_t = Column(String(20))
    is_active = Column(Boolean, default=True)

    vendors = relationship("Vendor", secondary="vendor_withholding_tax_link", back_populates="withholding_taxes")


class VendorWithHoldingTaxLink(Base):
    """Many-to-many join table: Vendor ↔ WithHoldingTax"""
    __tablename__ = "vendor_withholding_tax_link"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    withholding_tax_id = Column(Integer, ForeignKey("vendor_withholding_taxes.id", ondelete="CASCADE"), nullable=False)


class OrderNumber(Base):
    __tablename__ = "vendor_order_numbers"

    id = Column(Integer, primary_key=True, index=True)
    type_of_service_id = Column(Integer, ForeignKey("vendor_type_of_services.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    type_of_service = relationship("TypeOfService", back_populates="order_numbers")


class TypeOfService(Base):
    __tablename__ = "vendor_type_of_services"

    id = Column(Integer, primary_key=True, index=True)
    gl_account_id = Column(Integer, ForeignKey("vendor_gl_accounts.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    gl_account = relationship("GLAccount", back_populates="type_of_services")
    order_numbers = relationship("OrderNumber", back_populates="type_of_service", cascade="all, delete-orphan")


class GLAccount(Base):
    __tablename__ = "vendor_gl_accounts"

    id = Column(Integer, primary_key=True, index=True)
    gl_number = Column(String(50), nullable=False)

    type_of_services = relationship("TypeOfService", back_populates="gl_account", cascade="all, delete-orphan")


class TypeOfSponsorshipRequest(Base):
    __tablename__ = "vendor_sponsorship_request_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)


class BusinessPlace(Base):
    __tablename__ = "vendor_business_places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)


class BusinessArea(Base):
    __tablename__ = "vendor_business_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)


class VendorTaxCode(Base):
    __tablename__ = "vendor_tax_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)


class HANSACode(Base):
    __tablename__ = "vendor_hansa_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)


class HSNSACCode(Base):
    __tablename__ = "vendor_hsn_sac_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False)
    description = Column(String(300))
    is_active = Column(Boolean, default=True)
