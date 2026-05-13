from sqlalchemy.orm import Session
from app.models.rbac import Role, Page, RolePageAccess
from app.models.user import User, UserRole

# Default roles to seed
DEFAULT_ROLES = [
    {"name": "Administrator", "description": "Full system access"},
    {"name": "Marketing Head", "description": "Marketing division head"},
    {"name": "Division Head", "description": "Division level head"},
    {"name": "Compliance User", "description": "Compliance and audit access"},
    {"name": "Finance User", "description": "Finance and invoice access"},
    {"name": "User", "description": "Standard user access"},
]

# All pages in the app
DEFAULT_PAGES = [
    {"page_key": "dashboard", "page_label": "Dashboard", "page_path": "/", "nav_group": "General"},
    {"page_key": "events_list", "page_label": "Events", "page_path": "/events", "nav_group": "Events"},
    {"page_key": "events_create", "page_label": "Create Event", "page_path": "/events/new", "nav_group": "Events"},
    {"page_key": "events_detail", "page_label": "Event Detail", "page_path": "/events/:id", "nav_group": "Events"},
    {"page_key": "events_edit", "page_label": "Edit Event", "page_path": "/events/:id/edit", "nav_group": "Events"},
    {"page_key": "events_post_docs", "page_label": "Post Event Documents", "page_path": "/events/:id/post-documents", "nav_group": "Events"},
    {"page_key": "approvals_list", "page_label": "Approvals", "page_path": "/approvals", "nav_group": "Approvals"},
    {"page_key": "approvals_create", "page_label": "Create Invoice", "page_path": "/approvals/new", "nav_group": "Approvals"},
    {"page_key": "approvals_detail", "page_label": "Invoice Detail", "page_path": "/approvals/:id", "nav_group": "Approvals"},
    {"page_key": "vendors_list", "page_label": "Vendors", "page_path": "/vendors", "nav_group": "Vendors"},
    {"page_key": "promotional_list", "page_label": "Promotional", "page_path": "/promotional", "nav_group": "Promotional"},
    {"page_key": "promotional_create", "page_label": "Create Promotional", "page_path": "/promotional/new", "nav_group": "Promotional"},
    {"page_key": "brs_list", "page_label": "BRS", "page_path": "/brs", "nav_group": "BRS"},
    {"page_key": "brs_create", "page_label": "Create BRS", "page_path": "/brs/new", "nav_group": "BRS"},
    {"page_key": "brs_detail", "page_label": "BRS Detail", "page_path": "/brs/:id", "nav_group": "BRS"},
    {"page_key": "brs_edit", "page_label": "Edit BRS", "page_path": "/brs/:id/edit", "nav_group": "BRS"},
    {"page_key": "brs_survey_builder", "page_label": "Survey Builder", "page_path": "/brs/survey-builder", "nav_group": "BRS"},
    {"page_key": "brs_bulk_upload", "page_label": "Bulk BRS Upload", "page_path": "/brs/bulk-upload", "nav_group": "BRS"},
    {"page_key": "masters", "page_label": "Masters", "page_path": "/masters", "nav_group": "Masters"},
    {"page_key": "reports", "page_label": "Reports", "page_path": "/reports", "nav_group": "Reports"},
    {"page_key": "access_management", "page_label": "Access Management", "page_path": "/access", "nav_group": "Admin"},
    {"page_key": "users", "page_label": "Users", "page_path": "/users", "nav_group": "Admin"},
    {"page_key": "hierarchy", "page_label": "Hierarchy", "page_path": "/hierarchy", "nav_group": "Admin"},
    {"page_key": "agreements_list", "page_label": "Agreements", "page_path": "/agreements", "nav_group": "Agreements"},
    {"page_key": "agreements_create", "page_label": "Create Agreement", "page_path": "/agreements/new", "nav_group": "Agreements"},
    {"page_key": "admin_rbac", "page_label": "RBAC Config", "page_path": "/admin/rbac", "nav_group": "Admin"},
    {"page_key": "admin_workflows", "page_label": "Approval Workflows", "page_path": "/admin/workflows", "nav_group": "Admin"},
]


def seed_roles(db: Session) -> None:
    """Seed default roles if they don't exist."""
    for role_data in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if not existing:
            db.add(Role(**role_data))
    db.commit()


def seed_pages(db: Session) -> None:
    """Seed all app pages if they don't exist."""
    for page_data in DEFAULT_PAGES:
        existing = db.query(Page).filter(Page.page_key == page_data["page_key"]).first()
        if not existing:
            db.add(Page(**page_data))
    db.commit()


def seed_admin_full_access(db: Session) -> None:
    """Give Administrator role access to all pages."""
    admin_role = db.query(Role).filter(Role.name == "Administrator").first()
    if not admin_role:
        return
    all_pages = db.query(Page).all()
    for page in all_pages:
        existing = (
            db.query(RolePageAccess)
            .filter(RolePageAccess.role_id == admin_role.id, RolePageAccess.page_id == page.id)
            .first()
        )
        if not existing:
            db.add(RolePageAccess(role_id=admin_role.id, page_id=page.id, can_access=True))
    db.commit()


def seed_rbac(db: Session) -> None:
    """Run all RBAC seeding."""
    seed_roles(db)
    seed_pages(db)
    seed_admin_full_access(db)


def get_user_accessible_pages(db: Session, user: User) -> list[str]:
    """Get list of page_keys the user can access based on their primary role + additional roles."""
    # Admins/superusers get everything
    if user.is_superuser or user.role in (UserRole.ADMINISTRATOR, UserRole.MY_ADMIN):
        pages = db.query(Page).filter(Page.is_active == True).all()
        return [p.page_key for p in pages]

    # Collect all RBAC role names for this user (primary + additional)
    role_names = set()

    # Primary role
    primary_role_name = _map_user_role_to_rbac_role(user.role)
    role_names.add(primary_role_name)

    # Additional roles from user_role_assignments
    if user.role_assignments:
        for ra in user.role_assignments:
            mapped = _map_assignment_to_rbac_role(ra.role)
            if mapped:
                role_names.add(mapped)

    # Check if any of the additional roles is Administrator
    if "Administrator" in role_names:
        pages = db.query(Page).filter(Page.is_active == True).all()
        return [p.page_key for p in pages]

    # Get all matching RBAC roles
    roles = db.query(Role).filter(Role.name.in_(role_names), Role.is_active == True).all()
    if not roles:
        return ["dashboard"]

    role_ids = [r.id for r in roles]

    # Merge access from all roles (union)
    access_entries = (
        db.query(RolePageAccess)
        .join(Page)
        .filter(
            RolePageAccess.role_id.in_(role_ids),
            RolePageAccess.can_access == True,
            Page.is_active == True,
        )
        .all()
    )
    # Deduplicate page keys
    return list(set(entry.page.page_key for entry in access_entries))


def _map_user_role_to_rbac_role(user_role: UserRole) -> str:
    """Map the existing UserRole enum to RBAC role name."""
    mapping = {
        UserRole.ADMINISTRATOR: "Administrator",
        UserRole.MY_ADMIN: "Administrator",
        UserRole.MARKETING_HEAD: "Marketing Head",
        UserRole.DIVISION_HEAD: "Division Head",
        UserRole.COMPLIANCE_USER: "Compliance User",
        UserRole.FINANCE_USER: "Finance User",
        UserRole.USER: "User",
        UserRole.DIVISION_COORDINATOR: "User",
        UserRole.GST_USER: "Finance User",
        UserRole.OPEX_USER: "Finance User",
        UserRole.FUNCTIONAL_USER: "User",
        UserRole.ANONYMOUS: "User",
    }
    return mapping.get(user_role, "User")


def _map_assignment_to_rbac_role(role_str: str) -> str:
    """Map a role assignment string (from user_role_assignments table) to RBAC role name."""
    mapping = {
        "Administrator": "Administrator",
        "MyAdmin": "Administrator",
        "MarketingHead": "Marketing Head",
        "DivisionHead": "Division Head",
        "ComplianceUser": "Compliance User",
        "FinanceUser": "Finance User",
        "User": "User",
        "DivisionCoOrdinator": "User",
        "GSTuser": "Finance User",
        "OPEXUser": "Finance User",
        "FunctionalUser": "User",
        "Anonymous": "User",
    }
    return mapping.get(role_str, "User")
