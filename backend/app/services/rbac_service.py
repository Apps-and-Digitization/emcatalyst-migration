from sqlalchemy.orm import Session
from app.models.rbac import Role, Page, RolePageAccess
from app.models.user import User

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
    {"page_key": "brs_list", "page_label": "BRS", "page_path": "/brs", "nav_group": "BRS"},
    {"page_key": "brs_create", "page_label": "Create BRS", "page_path": "/brs/new", "nav_group": "BRS"},
    {"page_key": "brs_detail", "page_label": "BRS Detail", "page_path": "/brs/:id", "nav_group": "BRS"},
    {"page_key": "brs_edit", "page_label": "Edit BRS", "page_path": "/brs/:id/edit", "nav_group": "BRS"},
    {"page_key": "brs_survey_builder", "page_label": "Survey Builder", "page_path": "/brs/survey-builder", "nav_group": "BRS"},
    {"page_key": "brs_bulk_upload", "page_label": "Bulk BRS Upload", "page_path": "/brs/bulk-upload", "nav_group": "BRS"},
    {"page_key": "masters", "page_label": "Masters", "page_path": "/masters", "nav_group": "Masters"},
    {"page_key": "masters_entities", "page_label": "Entities", "page_path": "/masters/entities", "nav_group": "Masters"},
    {"page_key": "masters_entities_add", "page_label": "Add Entity", "page_path": "/masters/entities/add", "nav_group": "Masters"},
    {"page_key": "masters_entities_edit", "page_label": "Edit Entity", "page_path": "/masters/entities/edit", "nav_group": "Masters"},
    {"page_key": "masters_divisions", "page_label": "Divisions", "page_path": "/masters/divisions", "nav_group": "Masters"},
    {"page_key": "masters_divisions_add", "page_label": "Add Division", "page_path": "/masters/divisions/add", "nav_group": "Masters"},
    {"page_key": "masters_divisions_edit", "page_label": "Edit Division", "page_path": "/masters/divisions/edit", "nav_group": "Masters"},
    {"page_key": "masters_doctors", "page_label": "Doctors", "page_path": "/masters/doctors", "nav_group": "Masters"},
    {"page_key": "masters_doctors_add", "page_label": "Add Doctor", "page_path": "/masters/doctors/add", "nav_group": "Masters"},
    {"page_key": "masters_doctors_edit", "page_label": "Edit Doctor", "page_path": "/masters/doctors/edit", "nav_group": "Masters"},
    {"page_key": "masters_brands", "page_label": "Brands", "page_path": "/masters/brands", "nav_group": "Masters"},
    {"page_key": "masters_brands_add", "page_label": "Add Brand", "page_path": "/masters/brands/add", "nav_group": "Masters"},
    {"page_key": "masters_brands_edit", "page_label": "Edit Brand", "page_path": "/masters/brands/edit", "nav_group": "Masters"},
    {"page_key": "masters_therapeutics", "page_label": "Therapeutics", "page_path": "/masters/therapeutics", "nav_group": "Masters"},
    {"page_key": "masters_therapeutics_add", "page_label": "Add Therapeutic", "page_path": "/masters/therapeutics/add", "nav_group": "Masters"},
    {"page_key": "masters_therapeutics_edit", "page_label": "Edit Therapeutic", "page_path": "/masters/therapeutics/edit", "nav_group": "Masters"},
    {"page_key": "masters_document_types", "page_label": "Document Types", "page_path": "/masters/document-types", "nav_group": "Masters"},
    {"page_key": "masters_document_types_add", "page_label": "Add Document Type", "page_path": "/masters/document-types/add", "nav_group": "Masters"},
    {"page_key": "masters_document_types_edit", "page_label": "Edit Document Type", "page_path": "/masters/document-types/edit", "nav_group": "Masters"},
    {"page_key": "masters_meals", "page_label": "Meals", "page_path": "/masters/meals", "nav_group": "Masters"},
    {"page_key": "masters_meals_add", "page_label": "Add Meal", "page_path": "/masters/meals/add", "nav_group": "Masters"},
    {"page_key": "masters_meals_edit", "page_label": "Edit Meal", "page_path": "/masters/meals/edit", "nav_group": "Masters"},
    {"page_key": "masters_fmv_parameters", "page_label": "FMV Parameters", "page_path": "/masters/fmv-parameters", "nav_group": "Masters"},
    {"page_key": "masters_fmv_parameters_add", "page_label": "Add FMV Parameter", "page_path": "/masters/fmv-parameters/add", "nav_group": "Masters"},
    {"page_key": "masters_fmv_parameters_edit", "page_label": "Edit FMV Parameter", "page_path": "/masters/fmv-parameters/edit", "nav_group": "Masters"},
    {"page_key": "budget_events", "page_label": "Event Budget", "page_path": "/budget/events", "nav_group": "Budget"},
    {"page_key": "budget_events_add", "page_label": "Add Event Budget", "page_path": "/budget/events/add", "nav_group": "Budget"},
    {"page_key": "budget_events_edit", "page_label": "Edit Event Budget", "page_path": "/budget/events/edit", "nav_group": "Budget"},
    {"page_key": "budget_brs", "page_label": "BRS Budget", "page_path": "/budget/brs", "nav_group": "Budget"},
    {"page_key": "budget_brs_add", "page_label": "Add BRS Budget", "page_path": "/budget/brs/add", "nav_group": "Budget"},
    {"page_key": "budget_brs_edit", "page_label": "Edit BRS Budget", "page_path": "/budget/brs/edit", "nav_group": "Budget"},
    {"page_key": "reports_events", "page_label": "Event Report", "page_path": "/reports/events", "nav_group": "Reports"},
    {"page_key": "reports_cme_events", "page_label": "CME Event Report", "page_path": "/reports/cme-events", "nav_group": "Reports"},
    {"page_key": "reports_fmv_parameters", "page_label": "FMV Parameter Report", "page_path": "/reports/fmv-parameters", "nav_group": "Reports"},
    {"page_key": "vendor_vendors", "page_label": "Vendors", "page_path": "/vendor/vendors", "nav_group": "Vendor"},
    {"page_key": "vendor_vendors_add", "page_label": "Add Vendor", "page_path": "/vendor/vendors/add", "nav_group": "Vendor"},
    {"page_key": "vendor_vendors_edit", "page_label": "Edit Vendor", "page_path": "/vendor/vendors/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_order_numbers", "page_label": "Order Numbers", "page_path": "/vendor/order-numbers", "nav_group": "Vendor"},
    {"page_key": "vendor_order_numbers_add", "page_label": "Add Order Number", "page_path": "/vendor/order-numbers/add", "nav_group": "Vendor"},
    {"page_key": "vendor_order_numbers_edit", "page_label": "Edit Order Number", "page_path": "/vendor/order-numbers/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_type_of_services", "page_label": "Type of Services", "page_path": "/vendor/type-of-services", "nav_group": "Vendor"},
    {"page_key": "vendor_type_of_services_add", "page_label": "Add Type of Service", "page_path": "/vendor/type-of-services/add", "nav_group": "Vendor"},
    {"page_key": "vendor_type_of_services_edit", "page_label": "Edit Type of Service", "page_path": "/vendor/type-of-services/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_gl_accounts", "page_label": "GL Accounts", "page_path": "/vendor/gl-accounts", "nav_group": "Vendor"},
    {"page_key": "vendor_gl_accounts_add", "page_label": "Add GL Account", "page_path": "/vendor/gl-accounts/add", "nav_group": "Vendor"},
    {"page_key": "vendor_gl_accounts_edit", "page_label": "Edit GL Account", "page_path": "/vendor/gl-accounts/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_withholding_tax", "page_label": "Withholding Tax", "page_path": "/vendor/withholding-tax", "nav_group": "Vendor"},
    {"page_key": "vendor_withholding_tax_add", "page_label": "Add Withholding Tax", "page_path": "/vendor/withholding-tax/add", "nav_group": "Vendor"},
    {"page_key": "vendor_withholding_tax_edit", "page_label": "Edit Withholding Tax", "page_path": "/vendor/withholding-tax/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_hsn_sac_codes", "page_label": "HSN/SAC Codes", "page_path": "/vendor/hsn-sac-codes", "nav_group": "Vendor"},
    {"page_key": "vendor_hsn_sac_codes_add", "page_label": "Add HSN/SAC Code", "page_path": "/vendor/hsn-sac-codes/add", "nav_group": "Vendor"},
    {"page_key": "vendor_hsn_sac_codes_edit", "page_label": "Edit HSN/SAC Code", "page_path": "/vendor/hsn-sac-codes/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_business_places", "page_label": "Business Places", "page_path": "/vendor/business-places", "nav_group": "Vendor"},
    {"page_key": "vendor_business_places_add", "page_label": "Add Business Place", "page_path": "/vendor/business-places/add", "nav_group": "Vendor"},
    {"page_key": "vendor_business_places_edit", "page_label": "Edit Business Place", "page_path": "/vendor/business-places/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_business_areas", "page_label": "Business Areas", "page_path": "/vendor/business-areas", "nav_group": "Vendor"},
    {"page_key": "vendor_business_areas_add", "page_label": "Add Business Area", "page_path": "/vendor/business-areas/add", "nav_group": "Vendor"},
    {"page_key": "vendor_business_areas_edit", "page_label": "Edit Business Area", "page_path": "/vendor/business-areas/edit", "nav_group": "Vendor"},
    {"page_key": "vendor_tax_codes", "page_label": "Tax Codes", "page_path": "/vendor/tax-codes", "nav_group": "Vendor"},
    {"page_key": "vendor_tax_codes_add", "page_label": "Add Tax Code", "page_path": "/vendor/tax-codes/add", "nav_group": "Vendor"},
    {"page_key": "vendor_tax_codes_edit", "page_label": "Edit Tax Code", "page_path": "/vendor/tax-codes/edit", "nav_group": "Vendor"},
    {"page_key": "users", "page_label": "Users", "page_path": "/users", "nav_group": "Admin"},
    {"page_key": "users_import", "page_label": "Import Users", "page_path": "/users/import", "nav_group": "Admin"},
    {"page_key": "users_edit", "page_label": "Edit Users", "page_path": "/users/edit", "nav_group": "Admin"},
    {"page_key": "hierarchy", "page_label": "Hierarchy", "page_path": "/hierarchy", "nav_group": "Admin"},
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
    """Seed all app pages — insert missing ones and update existing ones."""
    for page_data in DEFAULT_PAGES:
        existing = db.query(Page).filter(Page.page_key == page_data["page_key"]).first()
        if not existing:
            db.add(Page(**page_data))
        else:
            # Update label, path, nav_group if they changed
            existing.page_label = page_data["page_label"]
            existing.page_path = page_data["page_path"]
            existing.nav_group = page_data["nav_group"]
            existing.is_active = True
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
        else:
            existing.can_access = True
    db.commit()


def migrate_masters_access(db: Session) -> None:
    """Grant new master sub-pages to any role that had access to the old 'masters' page."""
    old_masters_page = db.query(Page).filter(Page.page_key == "masters").first()
    if not old_masters_page:
        return

    # Find all roles that have access to the old masters page
    access_entries = (
        db.query(RolePageAccess)
        .filter(RolePageAccess.page_id == old_masters_page.id, RolePageAccess.can_access == True)
        .all()
    )
    role_ids_with_access = [entry.role_id for entry in access_entries]

    if not role_ids_with_access:
        return

    # Get all new master sub-pages
    master_sub_pages = (
        db.query(Page)
        .filter(Page.page_key.like("masters_%"))
        .all()
    )

    # Grant access to each role that had the old masters access
    for role_id in role_ids_with_access:
        for page in master_sub_pages:
            existing = (
                db.query(RolePageAccess)
                .filter(RolePageAccess.role_id == role_id, RolePageAccess.page_id == page.id)
                .first()
            )
            if not existing:
                db.add(RolePageAccess(role_id=role_id, page_id=page.id, can_access=True))
    db.commit()


def seed_rbac(db: Session) -> None:
    """Run all RBAC seeding."""
    seed_roles(db)
    seed_pages(db)
    seed_admin_full_access(db)
    migrate_masters_access(db)


def get_user_accessible_pages(db: Session, user: User) -> list[str]:
    """Get list of page_keys the user can access based on their primary role + additional roles."""
    # Superusers get everything
    if user.is_superuser:
        pages = db.query(Page).filter(Page.is_active == True).all()
        return [p.page_key for p in pages]

    # Collect all role names for this user (primary + additional)
    role_names = set()

    # Primary role (now a plain string like "Administrator", "User", etc.)
    if user.role:
        role_names.add(user.role)

    # Additional roles from user_role_assignments
    if user.role_assignments:
        for ra in user.role_assignments:
            role_names.add(ra.role)

    # Check if user has Administrator role
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



