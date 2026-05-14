from sqlalchemy.orm import Session
from app.db.base import engine, Base
from app.core.security import get_password_hash
from app.core.config import settings


def create_tables():
    # Import all models so they register with Base.metadata
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)
    print("All tables created.")


def seed_data(db: Session):
    from app.models.user import User, Division, CostCenter, Function, Territory
    from app.models.master import EventType, DocumentType, Designation, CompanyCode, Enumeration

    # Admin user
    admin = db.query(User).filter(
        (User.employee_id == "EMP001") | (User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not admin:
        admin = User(
            employee_id="EMP001",
            email=settings.FIRST_SUPERUSER,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            first_name="System",
            last_name="Administrator",
            role="Administrator",
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
    else:
        # Ensure existing admin has all required fields
        if not admin.employee_id:
            admin.employee_id = "EMP001"
        if not admin.is_superuser:
            admin.is_superuser = True
        if admin.role != "Administrator":
            admin.role = "Administrator"

    # Divisions
    divisions = [
        ("ONCOLOGY", "Oncology"), ("CARDIOLOGY", "Cardiology"),
        ("NEUROLOGY", "Neurology"), ("DERMATOLOGY", "Dermatology"),
        ("GASTRO", "Gastroenterology"), ("ENDOCRINOLOGY", "Endocrinology"),
        ("RESPIRATOLOGY", "Respiratology"), ("UROLOGY", "Urology"),
        ("GYNECOLOGY", "Gynecology"), ("PEDIATRICS", "Pediatrics"),
        ("CORPORATE", "Corporate"), ("FINANCE", "Finance"),
    ]
    for code, name in divisions:
        if not db.query(Division).filter(Division.code == code).first():
            db.add(Division(code=code, name=name))

    # Event Types
    event_types = [
        ("CME", "Continuing Medical Education", 15000),
        ("CONF", "Conference/Symposium", 25000),
        ("WORKSHOP", "Workshop/Hands-on Training", 20000),
        ("ADVISORY", "Advisory Board Meeting", 30000),
        ("SPEAKER", "Speaker Program", 25000),
        ("ROUNDTABLE", "Round Table Discussion", 20000),
        ("WEBINAR", "Webinar/Virtual Event", 10000),
        ("PATIENT_PROG", "Patient Awareness Program", 5000),
    ]
    for code, name, fmv in event_types:
        if not db.query(EventType).filter(EventType.code == code).first():
            db.add(EventType(code=code, name=name, max_fmv=fmv))

    # Document Types
    doc_types = [
        ("INVITATION", "Event Invitation Letter", True),
        ("AGENDA", "Event Agenda/Program", True),
        ("ATTENDANCE", "Attendance Register", True),
        ("PHOTOS", "Event Photographs", False),
        ("INVOICE", "Vendor Invoice", True),
        ("PAN", "PAN Card", True),
        ("BANK", "Bank Details / Cancelled Cheque", True),
        ("CONSENT", "Speaker Consent Form", True),
        ("FMV_JUSTIFICATION", "FMV Justification", True),
    ]
    for code, name, mandatory in doc_types:
        if not db.query(DocumentType).filter(DocumentType.code == code).first():
            db.add(DocumentType(code=code, name=name, is_mandatory=mandatory))

    # Designations
    designations = [
        ("Medical Representative", "C"),
        ("Senior Medical Representative", "C+"),
        ("Area Business Manager", "B"),
        ("Regional Business Manager", "B+"),
        ("Zonal Business Manager", "A"),
        ("General Manager - Sales", "A+"),
        ("Product Manager", "B"),
        ("Senior Product Manager", "B+"),
        ("Medical Advisor", "B"),
    ]
    for title, grade in designations:
        if not db.query(Designation).filter(Designation.title == title).first():
            db.add(Designation(title=title, grade=grade))

    # Company Codes
    if not db.query(CompanyCode).filter(CompanyCode.code == "EMC1").first():
        db.add(CompanyCode(code="EMC1", name="Emcure Pharmaceuticals Ltd", country="IN", currency="INR"))

    # Enumerations
    enums = [
        ("event_status", "DRAFT", "Draft", 1),
        ("event_status", "SUBMITTED", "Submitted", 2),
        ("event_status", "APPROVED", "Approved", 3),
        ("event_status", "REJECTED", "Rejected", 4),
        ("payment_terms", "NET30", "Net 30 Days", 1),
        ("payment_terms", "NET60", "Net 60 Days", 2),
        ("payment_terms", "IMMEDIATE", "Immediate", 3),
        ("state", "MH", "Maharashtra", 1),
        ("state", "GJ", "Gujarat", 2),
        ("state", "KA", "Karnataka", 3),
        ("state", "TN", "Tamil Nadu", 4),
        ("state", "DL", "Delhi", 5),
    ]
    for cat, code, label, order in enums:
        if not db.query(Enumeration).filter(Enumeration.category == cat, Enumeration.code == code).first():
            db.add(Enumeration(category=cat, code=code, label=label, sort_order=order))

    db.commit()
    print("Seed data loaded.")


if __name__ == "__main__":
    from app.db.base import SessionLocal
    create_tables()
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
