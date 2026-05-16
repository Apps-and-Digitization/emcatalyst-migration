"""Seed GL Account, Type of Service, and Order Number master data from GL Account Master Excel."""
from sqlalchemy.orm import Session
from app.models.vendor import GLAccount, TypeOfService, OrderNumber

# (gl_no, type, type_of_service, order_no)
GL_ACCOUNT_DATA = [
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_001"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_002"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_003"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_004"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_006"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_007"),
    ("440215", "AGREEMENT", "PROFESSIONAL FEES", "PROF_215_008"),
    ("450216", "EDUCATIONAL GRANT", "MEDICAL CAMPS", "CAMP_216_008"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_011"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_012"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_017"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_018"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_019"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_020"),
    ("450235", "RESIDENTIAL CME", "CONTINUOUS MEDICAL EDUCAT", "RCME_235_021"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0001"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0002"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0007"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0008"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0009"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0010"),
    ("450235", "NON RES CME", "CONTINUOUS MEDICAL EDUCAT", "CME_235_0011"),
    ("450211", "CONFERENCE", "CONF EVENT ARRANGMEN", "CONF_211_001"),
    ("450211", "CONFERENCE", "CONF EVENT ARRANGMEN", "CONF_211_002"),
    ("450211", "CONFERENCE", "CONF EVENT ARRANGMEN", "CONF_211_003"),
    ("450211", "CONFERENCE", "CONF EVENT ARRANGMEN", "CONF_211_004"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_001"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_002"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_003"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_004"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_005"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_006"),
    ("450210", "CONFERENCE", "CONFERENCES SPONSERSHIP /", "CONF_210_007"),
    ("450212", "CONFERENCE", "CONFERENCES STALL EXPENSE", "CONF_212_001"),
    ("450212", "CONFERENCE", "CONFERENCES STALL EXPENSE", "CONF_212_003"),
    ("450212", "CONFERENCE", "CONFERENCES STALL EXPENSE", "CONF_212_005"),
]


def seed_gl_accounts(db: Session) -> None:
    """Seed GL Account master data if tables are empty.
    
    Hierarchy: GLAccount -> TypeOfService -> OrderNumber
    """
    if db.query(OrderNumber).count() > 0:
        return

    gl_cache = {}   # gl_number -> GLAccount instance
    tos_cache = {}  # (gl_account_id, service_name) -> TypeOfService instance

    for gl_no, gl_type, type_of_service, order_no in GL_ACCOUNT_DATA:
        # Get or create GL Account (unique by gl_number)
        if gl_no not in gl_cache:
            gl = GLAccount(gl_number=gl_no)
            db.add(gl)
            db.flush()
            gl_cache[gl_no] = gl

        gl = gl_cache[gl_no]

        # Get or create Type of Service (unique per GL + service name)
        tos_key = (gl.id, type_of_service)
        if tos_key not in tos_cache:
            tos = TypeOfService(gl_account_id=gl.id, name=type_of_service, is_active=True)
            db.add(tos)
            db.flush()
            tos_cache[tos_key] = tos

        tos = tos_cache[tos_key]

        # Create Order Number (each is unique)
        order = OrderNumber(type_of_service_id=tos.id, name=order_no, is_active=True)
        db.add(order)

    db.commit()
