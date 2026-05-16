from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from pydantic import BaseModel

from app.db.base import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor import (
    Vendor, WithHoldingTax, VendorWithHoldingTaxLink, OrderNumber, TypeOfService, GLAccount,
    BusinessPlace, BusinessArea, VendorTaxCode, HANSACode, HSNSACCode
)

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.post("/vendors/import")
def import_vendors_from_odata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Start vendor import as a background job. Returns job_id immediately.
    """
    from app.services.job_runner import create_job, run_job

    job = create_job(db, job_type="vendor_import", user_id=current_user.id)

    run_job(_vendor_import_task, job.id)

    return {"job_id": job.id, "message": "Import started"}


def _vendor_import_task(job_id: int):
    """Background task: fetch vendors from OData API and upsert into DB."""
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    from app.db.base import SessionLocal
    from app.services.job_runner import update_job_progress, complete_job, fail_job

    db = SessionLocal()
    try:
        from app.core.config import settings

        url = settings.VENDOR_ODATA_URL
        total_created = 0
        total_updated = 0
        total_fetched = 0
        batch_num = 0

        update_job_progress(db, job_id, progress=0, total=0, message="Connecting to OData API...")

        while url:
            batch_num += 1
            update_job_progress(db, job_id, progress=total_fetched, message=f"Fetching batch {batch_num}...")

            try:
                resp = requests.get(url, timeout=120, verify=False)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                fail_job(db, job_id, f"API fetch error on batch {batch_num}: {str(e)}")
                return

            records = data.get("value", [])
            total_fetched += len(records)

            update_job_progress(
                db, job_id,
                progress=total_fetched,
                message=f"Processing batch {batch_num} ({total_fetched} records fetched, {total_created} created, {total_updated} updated)..."
            )

            for record in records:
                lifnr = record.get("LIFNR", "").strip()
                bukrs = record.get("BUKRS", "").strip()
                lfa1 = record.get("LFA1") or {}

                if not lifnr:
                    continue

                existing = (
                    db.query(Vendor)
                    .filter(Vendor.lifnr == lifnr, Vendor.bukrs == bukrs)
                    .first()
                )

                vendor_data = {
                    "lifnr": lifnr,
                    "bukrs": bukrs,
                    "zterm": record.get("ZTERM") or lfa1.get("ZTERM") or "",
                    "erdat": record.get("ERDAT") or "",
                    "ernam": record.get("ERNAM") or "",
                    "name": lfa1.get("NAME1") or "",
                    "region": lfa1.get("REGION") or "",
                    "state": lfa1.get("STATE") or "",
                    "pan_number": lfa1.get("J_1IPANNO") or "",
                    "bankl": lfa1.get("BANKL") or "",
                    "bankn": lfa1.get("BANKN") or "",
                    "payment_method": lfa1.get("PAY_METH") or "",
                    "payment_block": lfa1.get("PAY_BLOCK") or "",
                    "gst_number": lfa1.get("STCEG") or "",
                }

                if existing:
                    for key, val in vendor_data.items():
                        setattr(existing, key, val)
                    total_updated += 1
                else:
                    db.add(Vendor(**vendor_data))
                    total_created += 1

            db.commit()
            url = data.get("@odata.nextLink")

        complete_job(db, job_id, result={
            "created": total_created,
            "updated": total_updated,
            "fetched": total_fetched,
            "batches": batch_num,
        })

    except Exception as e:
        fail_job(db, job_id, str(e))
    finally:
        db.close()


# ─── Vendors ───────────────────────────────────────────────────────────────────

@router.get("/vendors")
def list_vendors(
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    query = db.query(Vendor).filter(Vendor.is_active == True)
    if q:
        query = query.filter(
            (Vendor.name.ilike(f"%{q}%")) |
            (Vendor.lifnr.ilike(f"%{q}%")) |
            (Vendor.pan_number.ilike(f"%{q}%"))
        )
    total = query.count()
    vendors = query.order_by(Vendor.name).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_vendor_to_dict(v) for v in vendors], "total": total, "page": page, "page_size": page_size}


@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    v = db.query(Vendor).options(joinedload(Vendor.withholding_taxes)).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    result = _vendor_to_dict(v)
    result["withholding_tax_ids"] = [t.id for t in v.withholding_taxes]
    result["withholding_taxes"] = [
        {"id": t.id, "tax_code": t.tax_code, "name": t.name, "section": t.section, "rate": t.rate, "with_t": t.with_t}
        for t in v.withholding_taxes
    ]
    return result


@router.post("/vendors")
def create_vendor(
    lifnr: str = Query(...), name: str = Query(...),
    bukrs: Optional[str] = None, zterm: Optional[str] = None,
    region: Optional[str] = None, state: Optional[str] = None,
    pan_number: Optional[str] = None, bankl: Optional[str] = None,
    bankn: Optional[str] = None, payment_method: Optional[str] = None,
    payment_block: Optional[str] = None, block_desc: Optional[str] = None,
    gst_number: Optional[str] = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    existing = db.query(Vendor).filter(Vendor.lifnr == lifnr).first()
    if existing:
        raise HTTPException(400, "Vendor with this LIFNR already exists")
    vendor = Vendor(
        lifnr=lifnr, name=name, bukrs=bukrs, zterm=zterm,
        region=region, state=state, pan_number=pan_number,
        bankl=bankl, bankn=bankn, payment_method=payment_method,
        payment_block=payment_block, block_desc=block_desc, gst_number=gst_number,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return _vendor_to_dict(vendor)


@router.put("/vendors/{vendor_id}")
def update_vendor(
    vendor_id: int,
    lifnr: Optional[str] = None, name: Optional[str] = None,
    bukrs: Optional[str] = None, zterm: Optional[str] = None,
    region: Optional[str] = None, state: Optional[str] = None,
    pan_number: Optional[str] = None, bankl: Optional[str] = None,
    bankn: Optional[str] = None, payment_method: Optional[str] = None,
    payment_block: Optional[str] = None, block_desc: Optional[str] = None,
    gst_number: Optional[str] = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    if lifnr is not None: vendor.lifnr = lifnr
    if name is not None: vendor.name = name
    if bukrs is not None: vendor.bukrs = bukrs
    if zterm is not None: vendor.zterm = zterm
    if region is not None: vendor.region = region
    if state is not None: vendor.state = state
    if pan_number is not None: vendor.pan_number = pan_number
    if bankl is not None: vendor.bankl = bankl
    if bankn is not None: vendor.bankn = bankn
    if payment_method is not None: vendor.payment_method = payment_method
    if payment_block is not None: vendor.payment_block = payment_block
    if block_desc is not None: vendor.block_desc = block_desc
    if gst_number is not None: vendor.gst_number = gst_number
    db.commit()
    return _vendor_to_dict(vendor)


@router.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.is_active = False
    db.commit()
    return {"message": "Vendor deactivated"}


def _vendor_to_dict(v):
    return {
        "id": v.id, "lifnr": v.lifnr, "bukrs": v.bukrs, "zterm": v.zterm,
        "erdat": v.erdat, "ernam": v.ernam, "name": v.name, "region": v.region,
        "state": v.state, "pan_number": v.pan_number, "bankl": v.bankl,
        "bankn": v.bankn, "payment_method": v.payment_method,
        "payment_block": v.payment_block, "block_desc": v.block_desc,
        "gst_number": v.gst_number,
    }


# ─── Withholding Tax ──────────────────────────────────────────────────────────

@router.post("/vendors/{vendor_id}/withholding-taxes")
def add_withholding_tax(
    vendor_id: int,
    tax_code: str = Query(...), name: str = Query(...),
    section: Optional[str] = None, rate: Optional[str] = None, with_t: Optional[str] = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    tax = VendorWithHoldingTax(vendor_id=vendor_id, tax_code=tax_code, name=name, section=section, rate=rate, with_t=with_t)
    db.add(tax)
    db.commit()
    db.refresh(tax)
    return {"id": tax.id, "tax_code": tax.tax_code, "name": tax.name, "section": tax.section, "rate": tax.rate, "with_t": tax.with_t}


@router.delete("/vendors/{vendor_id}/withholding-taxes/{tax_id}")
def remove_withholding_tax(vendor_id: int, tax_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    tax = db.query(VendorWithHoldingTax).filter(VendorWithHoldingTax.id == tax_id, VendorWithHoldingTax.vendor_id == vendor_id).first()
    if not tax:
        raise HTTPException(404, "Tax entry not found")
    db.delete(tax)
    db.commit()
    return {"message": "Deleted"}


# ─── Order Numbers ─────────────────────────────────────────────────────────────

@router.get("/order-numbers")
def list_order_numbers(type_of_service_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    query = db.query(OrderNumber).filter(OrderNumber.is_active == True)
    if type_of_service_id:
        query = query.filter(OrderNumber.type_of_service_id == type_of_service_id)
    items = query.order_by(OrderNumber.name).all()
    return [{"id": i.id, "name": i.name, "type_of_service_id": i.type_of_service_id} for i in items]


@router.post("/order-numbers")
def create_order_number(name: str = Query(...), type_of_service_id: int = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = OrderNumber(name=name, type_of_service_id=type_of_service_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name, "type_of_service_id": item.type_of_service_id}


@router.put("/order-numbers/{item_id}")
def update_order_number(item_id: int, name: Optional[str] = None, type_of_service_id: Optional[int] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(OrderNumber).filter(OrderNumber.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if name is not None: item.name = name
    if type_of_service_id is not None: item.type_of_service_id = type_of_service_id
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "name": item.name, "type_of_service_id": item.type_of_service_id, "is_active": item.is_active}


@router.delete("/order-numbers/{item_id}")
def delete_order_number(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(OrderNumber).filter(OrderNumber.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── Type of Services ──────────────────────────────────────────────────────────

@router.get("/type-of-services")
def list_type_of_services(gl_account_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    query = db.query(TypeOfService).filter(TypeOfService.is_active == True)
    if gl_account_id:
        query = query.filter(TypeOfService.gl_account_id == gl_account_id)
    items = query.order_by(TypeOfService.name).all()
    return [{"id": i.id, "name": i.name, "gl_account_id": i.gl_account_id} for i in items]


@router.post("/type-of-services")
def create_type_of_service(name: str = Query(...), gl_account_id: int = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = TypeOfService(name=name, gl_account_id=gl_account_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name, "gl_account_id": item.gl_account_id}


@router.put("/type-of-services/{item_id}")
def update_type_of_service(item_id: int, name: Optional[str] = None, gl_account_id: Optional[int] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(TypeOfService).filter(TypeOfService.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if name is not None: item.name = name
    if gl_account_id is not None: item.gl_account_id = gl_account_id
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "name": item.name, "gl_account_id": item.gl_account_id, "is_active": item.is_active}


@router.delete("/type-of-services/{item_id}")
def delete_type_of_service(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(TypeOfService).filter(TypeOfService.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── GL Accounts ───────────────────────────────────────────────────────────────

@router.get("/gl-accounts")
def list_gl_accounts(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(GLAccount).all()
    return [{"id": i.id, "gl_number": i.gl_number} for i in items]


@router.post("/gl-accounts")
def create_gl_account(gl_number: str = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = GLAccount(gl_number=gl_number)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "gl_number": item.gl_number}


@router.delete("/gl-accounts/{item_id}")
def delete_gl_account(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(GLAccount).filter(GLAccount.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}


# ─── Vendor Withholding Tax Assignment (many-to-many) ──────────────────────────

@router.put("/vendors/{vendor_id}/withholding-taxes")
def set_vendor_withholding_taxes(
    vendor_id: int,
    withholding_tax_ids: str = Query(..., description="Comma-separated IDs"),
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    """Set the withholding taxes for a vendor (replaces existing assignments)."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")

    # Parse IDs
    ids = [int(x.strip()) for x in withholding_tax_ids.split(",") if x.strip()] if withholding_tax_ids else []

    # Clear existing
    db.query(VendorWithHoldingTaxLink).filter(VendorWithHoldingTaxLink.vendor_id == vendor_id).delete()

    # Add new
    for tax_id in ids:
        db.add(VendorWithHoldingTaxLink(vendor_id=vendor_id, withholding_tax_id=tax_id))

    db.commit()
    return {"message": f"Assigned {len(ids)} withholding taxes to vendor"}

@router.get("/withholding-taxes")
def list_all_withholding_taxes(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(WithHoldingTax).filter(WithHoldingTax.is_active == True).order_by(WithHoldingTax.tax_code).all()
    return [
        {"id": t.id, "tax_code": t.tax_code, "name": t.name, "section": t.section, "rate": t.rate, "with_t": t.with_t}
        for t in items
    ]


@router.post("/withholding-taxes")
def create_withholding_tax(
    tax_code: str = Query(...), name: str = Query(...),
    section: Optional[str] = None, rate: Optional[str] = None, with_t: Optional[str] = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    tax = WithHoldingTax(tax_code=tax_code, name=name, section=section, rate=rate, with_t=with_t)
    db.add(tax)
    db.commit()
    db.refresh(tax)
    return {"id": tax.id, "tax_code": tax.tax_code, "name": tax.name, "section": tax.section, "rate": tax.rate, "with_t": tax.with_t}


@router.put("/withholding-taxes/{item_id}")
def update_withholding_tax(
    item_id: int,
    tax_code: Optional[str] = None, name: Optional[str] = None,
    section: Optional[str] = None, rate: Optional[str] = None, with_t: Optional[str] = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_active_user),
):
    item = db.query(WithHoldingTax).filter(WithHoldingTax.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if tax_code is not None: item.tax_code = tax_code
    if name is not None: item.name = name
    if section is not None: item.section = section
    if rate is not None: item.rate = rate
    if with_t is not None: item.with_t = with_t
    db.commit()
    return {"id": item.id, "tax_code": item.tax_code, "name": item.name, "section": item.section, "rate": item.rate, "with_t": item.with_t}


@router.delete("/withholding-taxes/{item_id}")
def delete_withholding_tax(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(WithHoldingTax).filter(WithHoldingTax.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── HSN/SAC Codes ─────────────────────────────────────────────────────────────

@router.get("/hsn-sac-codes")
def list_hsn_sac_codes(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(HSNSACCode).filter(HSNSACCode.is_active == True).order_by(HSNSACCode.code).all()
    return [{"id": i.id, "code": i.code, "description": i.description} for i in items]


@router.post("/hsn-sac-codes")
def create_hsn_sac_code(code: str = Query(...), description: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = HSNSACCode(code=code, description=description)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "code": item.code, "description": item.description}


@router.put("/hsn-sac-codes/{item_id}")
def update_hsn_sac_code(item_id: int, code: Optional[str] = None, description: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(HSNSACCode).filter(HSNSACCode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if code is not None: item.code = code
    if description is not None: item.description = description
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "code": item.code, "description": item.description, "is_active": item.is_active}


@router.delete("/hsn-sac-codes/{item_id}")
def delete_hsn_sac_code(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(HSNSACCode).filter(HSNSACCode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── Business Places ───────────────────────────────────────────────────────────

@router.get("/business-places")
def list_business_places(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(BusinessPlace).filter(BusinessPlace.is_active == True).all()
    return [{"id": i.id, "name": i.name} for i in items]


@router.post("/business-places")
def create_business_place(name: str = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = BusinessPlace(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name}


@router.put("/business-places/{item_id}")
def update_business_place(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(BusinessPlace).filter(BusinessPlace.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if name is not None: item.name = name
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "name": item.name, "is_active": item.is_active}


@router.delete("/business-places/{item_id}")
def delete_business_place(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(BusinessPlace).filter(BusinessPlace.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── Business Areas ────────────────────────────────────────────────────────────

@router.get("/business-areas")
def list_business_areas(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(BusinessArea).filter(BusinessArea.is_active == True).all()
    return [{"id": i.id, "name": i.name} for i in items]


@router.post("/business-areas")
def create_business_area(name: str = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = BusinessArea(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name}


@router.put("/business-areas/{item_id}")
def update_business_area(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(BusinessArea).filter(BusinessArea.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if name is not None: item.name = name
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "name": item.name, "is_active": item.is_active}


@router.delete("/business-areas/{item_id}")
def delete_business_area(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(BusinessArea).filter(BusinessArea.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── Tax Codes ─────────────────────────────────────────────────────────────────

@router.get("/tax-codes")
def list_tax_codes(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(VendorTaxCode).filter(VendorTaxCode.is_active == True).all()
    return [{"id": i.id, "code": i.code} for i in items]


@router.post("/tax-codes")
def create_tax_code(code: str = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = VendorTaxCode(code=code)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "code": item.code}


@router.put("/tax-codes/{item_id}")
def update_tax_code(item_id: int, code: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(VendorTaxCode).filter(VendorTaxCode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if code is not None: item.code = code
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "code": item.code, "is_active": item.is_active}


@router.delete("/tax-codes/{item_id}")
def delete_tax_code(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(VendorTaxCode).filter(VendorTaxCode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ─── HANSA Codes ───────────────────────────────────────────────────────────────

@router.get("/hansa-codes")
def list_hansa_codes(db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    items = db.query(HANSACode).filter(HANSACode.is_active == True).all()
    return [{"id": i.id, "code": i.code} for i in items]


@router.post("/hansa-codes")
def create_hansa_code(code: str = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = HANSACode(code=code)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "code": item.code}


@router.put("/hansa-codes/{item_id}")
def update_hansa_code(item_id: int, code: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(HANSACode).filter(HANSACode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    if code is not None: item.code = code
    if is_active is not None: item.is_active = is_active
    db.commit()
    return {"id": item.id, "code": item.code, "is_active": item.is_active}


@router.delete("/hansa-codes/{item_id}")
def delete_hansa_code(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    item = db.query(HANSACode).filter(HANSACode.id == item_id).first()
    if not item: raise HTTPException(404, "Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deactivated"}
