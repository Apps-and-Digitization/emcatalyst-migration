from sqlalchemy.orm import Session
from app.db.base import engine, Base
from app.core.security import get_password_hash
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def create_tables():
    # Import all models so they register with Base.metadata
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)
    logger.info("All tables created.")


def seed_data(db: Session):
    from app.models.user import User, Division, Territory
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
    logger.info("Seed data loaded.")

    # Seed FMV Parameters
    _seed_fmv_parameters(db)


def _seed_fmv_parameters(db: Session):
    from app.models.master import FmvParameter

    # Only seed if table is empty
    if db.query(FmvParameter).count() > 0:
        return

    fmv_data = [
        # 1. Clinical Practice Experience
        ("Clinical Practice Experience", "A", "More than 15 Years post graduation", 4, 1),
        ("Clinical Practice Experience", "B", "11 to 15 Years post graduation", 3, 2),
        ("Clinical Practice Experience", "C", "5 to 10 Years post graduation", 2, 3),
        ("Clinical Practice Experience", "D", "≤ 5 Years after post graduation", 1, 4),
        # 2. Publications in literature
        ("Publications in literature", "A", "More than 25 publications and/or member of editorial board of any peer reviewed publications", 4, 1),
        ("Publications in literature", "B", "10 to 25 publications and/or member of editorial board of any peer reviewed publications", 3, 2),
        ("Publications in literature", "C", "Less than 10 publications", 2, 3),
        ("Publications in literature", "D", "No Publications", 1, 4),
        # 3. Prior experience of Congresses
        ("Prior experience of Congresses", "A", "Member or past member at international level medical congresses or meeting (excluding poster presentation)", 4, 1),
        ("Prior experience of Congresses", "B", "Member or past member at national level medical congresses or meeting (excluding poster presentation)", 3, 2),
        ("Prior experience of Congresses", "C", "Member or past member of state level medical congresses or meetings (excluding poster presentation)", 2, 3),
        ("Prior experience of Congresses", "D", "No or low experience", 1, 4),
        # 4. Professional Position
        ("Professional Position", "A", "Senior Consultant/Director/HOD of multispecialty hospital", 4, 1),
        ("Professional Position", "B", "Consultant with > 15 years duration of practice or Associate professor", 3, 2),
        ("Professional Position", "C", "HCP/Consultant with < 15 years duration of practice or Lecturer at hospital or institute", 2, 3),
        ("Professional Position", "D", "Non physician HCP", 1, 4),
        # 5. Experience as an investigator in clinical trials
        ("Experience as an investigator in clinical trials", "A", "Primary investigator for 2 or more clinical trials", 4, 1),
        ("Experience as an investigator in clinical trials", "B", "Clinical trial experience", 3, 2),
        ("Experience as an investigator in clinical trials", "C", "No experience", 2, 3),
        # 6. Area of Expertise
        ("Area of Expertise", "A", "Super-specialty", 4, 1),
        ("Area of Expertise", "B", "Specialty", 3, 2),
        ("Area of Expertise", "C", "General Practitioners", 2, 3),
    ]

    for param_name, option_code, option_label, points, sort_order in fmv_data:
        db.add(FmvParameter(
            parameter_name=param_name,
            option_code=option_code,
            option_label=option_label,
            points=points,
            sort_order=sort_order,
        ))

    db.commit()
    logger.info("FMV Parameters seeded.")


if __name__ == "__main__":
    from app.db.base import SessionLocal
    create_tables()
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
