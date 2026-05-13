from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from app.db.base import get_db
from app.api.deps import require_admin
from app.models.master import (
    EventType, DocumentType, Designation, CompanyCode, Enumeration,
    HcpDoctor, FmvCriteria, FmvParameter, MasterSpeciality, MasterHcpRole,
    MasterTherapeutic, MasterState,
    MasterBrand, MasterMeal, MasterCity, MasterSponsorshipType
)
from app.models.user import Division
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/master", tags=["master-data"])


class EventTypeOut(BaseModel):
    id: int
    code: Optional[str] = None
    name: str
    max_fmv: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class EnumerationOut(BaseModel):
    id: int
    category: str
    code: str
    label: str
    sort_order: int

    class Config:
        from_attributes = True


class HcpDoctorOut(BaseModel):
    id: int
    division: Optional[str] = None
    territory_name: Optional[str] = None
    employee_code: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    uid_number: Optional[str] = None
    sbu_code: Optional[str] = None
    gender: Optional[str] = None
    doctor_type: Optional[str] = None
    qualification: Optional[str] = None
    speciality: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    town_name: Optional[str] = None
    birthday: Optional[str] = None
    service_preference: Optional[str] = None
    area_of_practice: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    pan_number: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    max_capping: Optional[Decimal] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class FmvCriteriaOut(BaseModel):
    id: int
    mendix_id: Optional[str] = None
    clinical_practice_experience: Optional[str] = None
    investigator_experience: Optional[str] = None
    expertise: Optional[str] = None
    professional_position: Optional[str] = None
    congress_experience: Optional[str] = None
    publications: Optional[str] = None

    class Config:
        from_attributes = True


class MasterItemOut(BaseModel):
    id: int
    mendix_id: Optional[str] = None
    name: str
    is_active: bool = True

    class Config:
        from_attributes = True


class DivisionOut(BaseModel):
    id: int
    mendix_id: Optional[str] = None
    name: str
    code: Optional[str] = None
    cluster: Optional[str] = None
    costcenter: Optional[str] = None
    profitcenter: Optional[str] = None
    eventcodeprefix: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


@router.get("/event-types", response_model=List[EventTypeOut])
def list_event_types(all: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    q = db.query(EventType)
    if not all:
        q = q.filter(EventType.is_active == True)
    return q.all()


@router.post("/event-types")
def create_event_type(
    name: str, code: Optional[str] = None, max_fmv: Optional[float] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    et = EventType(name=name, code=code, max_fmv=max_fmv)
    db.add(et)
    db.commit()
    db.refresh(et)
    return {"id": et.id, "name": et.name, "code": et.code, "max_fmv": et.max_fmv}


@router.put("/event-types/{et_id}")
def update_event_type(
    et_id: int, name: Optional[str] = None, code: Optional[str] = None,
    max_fmv: Optional[float] = None, is_active: Optional[bool] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    et = db.query(EventType).filter(EventType.id == et_id).first()
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")
    if name is not None:
        et.name = name
    if code is not None:
        et.code = code
    if max_fmv is not None:
        et.max_fmv = max_fmv
    if is_active is not None:
        et.is_active = is_active
    db.commit()
    return {"ok": True}


@router.delete("/event-types/{et_id}")
def delete_event_type(et_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    et = db.query(EventType).filter(EventType.id == et_id).first()
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")
    db.delete(et)
    db.commit()
    return {"ok": True}


@router.get("/document-types")
def list_document_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(DocumentType).filter(DocumentType.is_active == True).all()


@router.get("/designations")
def list_designations(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Designation).filter(Designation.is_active == True).all()


@router.get("/company-codes")
def list_company_codes(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(CompanyCode).filter(CompanyCode.is_active == True).all()


@router.get("/enumerations/{category}", response_model=List[EnumerationOut])
def list_enumerations(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(Enumeration).filter(
        Enumeration.category == category,
        Enumeration.is_active == True
    ).order_by(Enumeration.sort_order).all()


@router.get("/divisions", response_model=List[DivisionOut])
def list_divisions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(Division).filter(Division.is_active == True).order_by(Division.name).all()


@router.get("/hcp-doctors")
def search_hcp_doctors(
    q: Optional[str] = Query(None, description="Search by name, UID, pan, email, city"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(HcpDoctor).filter(HcpDoctor.is_active == True)
    if q:
        like = f"%{q}%"
        from sqlalchemy import or_
        query = query.filter(or_(
            HcpDoctor.full_name.ilike(like),
            HcpDoctor.first_name.ilike(like),
            HcpDoctor.last_name.ilike(like),
            HcpDoctor.uid_number.ilike(like),
            HcpDoctor.pan_number.ilike(like),
            HcpDoctor.email.ilike(like),
            HcpDoctor.city.ilike(like),
            HcpDoctor.speciality.ilike(like),
        ))
    doctors = query.order_by(HcpDoctor.full_name).limit(limit).all()
    # Add divisions to response
    result = []
    for doc in doctors:
        d = HcpDoctorOut.model_validate(doc).model_dump()
        d["divisions"] = [{"id": div.id, "name": div.name} for div in doc.divisions]
        result.append(d)
    return result


@router.get("/hcp-doctors/{doctor_id}", response_model=HcpDoctorOut)
def get_hcp_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    doctor = db.query(HcpDoctor).filter(HcpDoctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.get("/fmv-criteria", response_model=List[FmvCriteriaOut])
def list_fmv_criteria(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(FmvCriteria).filter(FmvCriteria.is_active == True).all()


@router.get("/fmv-parameters")
def list_fmv_parameters(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Get all FMV parameters grouped by parameter_name"""
    params = db.query(FmvParameter).filter(FmvParameter.is_active == True).order_by(FmvParameter.parameter_name, FmvParameter.sort_order).all()
    # Group by parameter_name
    grouped = {}
    for p in params:
        if p.parameter_name not in grouped:
            grouped[p.parameter_name] = []
        grouped[p.parameter_name].append({
            "id": p.id, "option_code": p.option_code,
            "option_label": p.option_label, "points": p.points
        })
    return grouped


@router.post("/fmv-parameters")
def create_fmv_parameter(
    parameter_name: str, option_label: str, option_code: str = "", points: int = 1,
    sort_order: int = 0,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    p = FmvParameter(parameter_name=parameter_name, option_label=option_label, option_code=option_code, points=points, sort_order=sort_order)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "parameter_name": p.parameter_name, "option_label": p.option_label, "points": p.points}


@router.put("/fmv-parameters/{param_id}")
def update_fmv_parameter(
    param_id: int, option_label: Optional[str] = None, points: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    p = db.query(FmvParameter).filter(FmvParameter.id == param_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if option_label is not None: p.option_label = option_label
    if points is not None: p.points = points
    if is_active is not None: p.is_active = is_active
    db.commit()
    return {"ok": True}


@router.delete("/fmv-parameters/{param_id}")
def delete_fmv_parameter(param_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    p = db.query(FmvParameter).filter(FmvParameter.id == param_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# --- HCP Doctors CRUD ---

@router.post("/hcp-doctors", response_model=HcpDoctorOut)
def create_hcp_doctor(
    full_name: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    middle_name: Optional[str] = None,
    division: Optional[str] = None,
    division_ids: Optional[str] = None,  # comma-separated division IDs
    territory_name: Optional[str] = None,
    employee_code: Optional[str] = None,
    uid_number: Optional[str] = None,
    sbu_code: Optional[str] = None,
    qualification: Optional[str] = None,
    speciality: Optional[str] = None,
    email: Optional[str] = None,
    pan_number: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    town_name: Optional[str] = None,
    mobile_number: Optional[str] = None,
    doctor_type: Optional[str] = None,
    gender: Optional[str] = None,
    birthday: Optional[str] = None,
    service_preference: Optional[str] = None,
    area_of_practice: Optional[str] = None,
    hourly_rate: Optional[float] = None,
    max_capping: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.master import HcpDoctorDivision
    doc = HcpDoctor(
        full_name=full_name, first_name=first_name, last_name=last_name, middle_name=middle_name,
        division=division, territory_name=territory_name,
        employee_code=employee_code, uid_number=uid_number, sbu_code=sbu_code,
        qualification=qualification, speciality=speciality, email=email, pan_number=pan_number,
        city=city, state=state, town_name=town_name, mobile_number=mobile_number,
        doctor_type=doctor_type, gender=gender, birthday=birthday,
        service_preference=service_preference, area_of_practice=area_of_practice,
        hourly_rate=hourly_rate, max_capping=max_capping,
    )
    db.add(doc)
    db.flush()
    # Add division associations
    if division_ids:
        for did in division_ids.split(','):
            did = did.strip()
            if did:
                db.add(HcpDoctorDivision(hcp_doctor_id=doc.id, division_id=int(did)))
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/hcp-doctors/{doctor_id}", response_model=HcpDoctorOut)
def update_hcp_doctor(
    doctor_id: int,
    full_name: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    middle_name: Optional[str] = None,
    division: Optional[str] = None,
    division_ids: Optional[str] = None,  # comma-separated
    territory_name: Optional[str] = None,
    employee_code: Optional[str] = None,
    uid_number: Optional[str] = None,
    sbu_code: Optional[str] = None,
    qualification: Optional[str] = None,
    speciality: Optional[str] = None,
    email: Optional[str] = None,
    pan_number: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    town_name: Optional[str] = None,
    mobile_number: Optional[str] = None,
    doctor_type: Optional[str] = None,
    gender: Optional[str] = None,
    birthday: Optional[str] = None,
    service_preference: Optional[str] = None,
    area_of_practice: Optional[str] = None,
    hourly_rate: Optional[float] = None,
    max_capping: Optional[float] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.master import HcpDoctorDivision
    doc = db.query(HcpDoctor).filter(HcpDoctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for field, value in [
        ("full_name", full_name), ("first_name", first_name), ("last_name", last_name),
        ("middle_name", middle_name), ("division", division),
        ("territory_name", territory_name), ("employee_code", employee_code),
        ("uid_number", uid_number), ("sbu_code", sbu_code),
        ("qualification", qualification), ("speciality", speciality),
        ("email", email), ("pan_number", pan_number),
        ("city", city), ("state", state), ("town_name", town_name),
        ("mobile_number", mobile_number), ("doctor_type", doctor_type),
        ("gender", gender), ("birthday", birthday),
        ("service_preference", service_preference), ("area_of_practice", area_of_practice),
        ("hourly_rate", hourly_rate), ("max_capping", max_capping),
        ("is_active", is_active),
    ]:
        if value is not None:
            setattr(doc, field, value)
    # Update division associations (replace all)
    if division_ids is not None:
        db.query(HcpDoctorDivision).filter(HcpDoctorDivision.hcp_doctor_id == doctor_id).delete()
        if division_ids:  # not empty string
            for did in division_ids.split(','):
                did = did.strip()
                if did:
                    db.add(HcpDoctorDivision(hcp_doctor_id=doctor_id, division_id=int(did)))
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/hcp-doctors/{doctor_id}")
def delete_hcp_doctor(doctor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doc = db.query(HcpDoctor).filter(HcpDoctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}


@router.get("/specialities", response_model=List[MasterItemOut])
def list_specialities(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(MasterSpeciality).order_by(MasterSpeciality.name).all()


@router.post("/specialities", response_model=MasterItemOut)
def create_speciality(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = MasterSpeciality(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/specialities/{item_id}", response_model=MasterItemOut)
def update_speciality(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterSpeciality).filter(MasterSpeciality.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    if name is not None:
        item.name = name
    if is_active is not None:
        item.is_active = is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/specialities/{item_id}")
def delete_speciality(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterSpeciality).filter(MasterSpeciality.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.get("/hcp-roles", response_model=List[MasterItemOut])
def list_hcp_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(MasterHcpRole).all()


@router.post("/hcp-roles", response_model=MasterItemOut)
def create_hcp_role(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = MasterHcpRole(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/hcp-roles/{item_id}", response_model=MasterItemOut)
def update_hcp_role(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None,
                    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterHcpRole).filter(MasterHcpRole.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    if name is not None:
        item.name = name
    if is_active is not None:
        item.is_active = is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/hcp-roles/{item_id}")
def delete_hcp_role(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterHcpRole).filter(MasterHcpRole.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.get("/therapeutics", response_model=List[MasterItemOut])
def list_therapeutics(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(MasterTherapeutic).order_by(MasterTherapeutic.name).all()


@router.post("/therapeutics", response_model=MasterItemOut)
def create_therapeutic(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = MasterTherapeutic(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/therapeutics/{item_id}", response_model=MasterItemOut)
def update_therapeutic(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None,
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterTherapeutic).filter(MasterTherapeutic.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    if name is not None:
        item.name = name
    if is_active is not None:
        item.is_active = is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/therapeutics/{item_id}")
def delete_therapeutic(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterTherapeutic).filter(MasterTherapeutic.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.get("/states", response_model=List[MasterItemOut])
def list_states(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(MasterState).order_by(MasterState.name).all()


@router.post("/states", response_model=MasterItemOut)
def create_state(name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = MasterState(name=name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/states/{item_id}", response_model=MasterItemOut)
def update_state(item_id: int, name: Optional[str] = None, is_active: Optional[bool] = None,
                 db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterState).filter(MasterState.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    if name is not None:
        item.name = name
    if is_active is not None:
        item.is_active = is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/states/{item_id}")
def delete_state(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(MasterState).filter(MasterState.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- Brands ---

class BrandOut(BaseModel):
    id: int
    mendix_id: Optional[str] = None
    name: str
    therapeutic_area: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


@router.get("/brands", response_model=List[BrandOut])
def list_brands(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(MasterBrand).filter(MasterBrand.is_active == True)
    if q:
        query = query.filter(MasterBrand.name.ilike(f"%{q}%"))
    return query.order_by(MasterBrand.name).all()


@router.post("/brands", response_model=BrandOut)
def create_brand(
    name: str,
    therapeutic_area: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    brand = MasterBrand(name=name, therapeutic_area=therapeutic_area)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.put("/brands/{brand_id}", response_model=BrandOut)
def update_brand(
    brand_id: int,
    name: Optional[str] = None,
    therapeutic_area: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    brand = db.query(MasterBrand).filter(MasterBrand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if name is not None:
        brand.name = name
    if therapeutic_area is not None:
        brand.therapeutic_area = therapeutic_area
    if is_active is not None:
        brand.is_active = is_active
    db.commit()
    db.refresh(brand)
    return brand


# --- Meals ---

@router.get("/meals")
def list_meals(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    meals = db.query(MasterMeal).filter(MasterMeal.is_active == True).order_by(MasterMeal.name).all()
    return [{"id": m.id, "name": m.name, "max_cost": float(m.max_cost) if m.max_cost else None, "is_active": m.is_active} for m in meals]


@router.post("/meals")
def create_meal(
    name: str, max_cost: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meal = MasterMeal(name=name, max_cost=max_cost)
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return {"id": meal.id, "name": meal.name, "max_cost": float(meal.max_cost) if meal.max_cost else None}


@router.put("/meals/{meal_id}")
def update_meal(
    meal_id: int,
    name: Optional[str] = None,
    max_cost: Optional[float] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meal = db.query(MasterMeal).filter(MasterMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    if name is not None:
        meal.name = name
    if max_cost is not None:
        meal.max_cost = max_cost
    if is_active is not None:
        meal.is_active = is_active
    db.commit()
    return {"ok": True}


@router.delete("/meals/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    meal = db.query(MasterMeal).filter(MasterMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}


# --- Cities ---

class CityOut(BaseModel):
    id: int
    name: str
    state: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


@router.get("/cities", response_model=List[CityOut])
def list_cities(
    q: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(MasterCity).filter(MasterCity.is_active == True)
    if q:
        query = query.filter(MasterCity.name.ilike(f"%{q}%"))
    if state:
        query = query.filter(MasterCity.state == state)
    return query.order_by(MasterCity.name).all()


@router.post("/cities", response_model=CityOut)
def create_city(
    name: str,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    city = MasterCity(name=name, state=state)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


@router.put("/cities/{city_id}", response_model=CityOut)
def update_city(
    city_id: int,
    name: Optional[str] = None,
    state: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    city = db.query(MasterCity).filter(MasterCity.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    if name is not None:
        city.name = name
    if state is not None:
        city.state = state
    if is_active is not None:
        city.is_active = is_active
    db.commit()
    db.refresh(city)
    return city


# --- Sponsorship Types ---

class SponsorshipTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


@router.get("/sponsorship-types", response_model=List[SponsorshipTypeOut])
def list_sponsorship_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(MasterSponsorshipType).filter(MasterSponsorshipType.is_active == True).all()


@router.post("/sponsorship-types", response_model=SponsorshipTypeOut)
def create_sponsorship_type(
    name: str,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    st = MasterSponsorshipType(name=name, description=description)
    db.add(st)
    db.commit()
    db.refresh(st)
    return st


@router.put("/sponsorship-types/{st_id}", response_model=SponsorshipTypeOut)
def update_sponsorship_type(
    st_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    st = db.query(MasterSponsorshipType).filter(MasterSponsorshipType.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Sponsorship type not found")
    if name is not None:
        st.name = name
    if description is not None:
        st.description = description
    if is_active is not None:
        st.is_active = is_active
    db.commit()
    db.refresh(st)
    return st


# --- Document Types (CRUD for admin) ---

class DocumentTypeOut(BaseModel):
    id: int
    code: Optional[str] = None
    name: str
    event_type_code: Optional[str] = None
    stage: Optional[str] = "pre"
    is_mandatory: bool = False
    is_active: bool = True

    class Config:
        from_attributes = True


@router.get("/document-types-full", response_model=List[DocumentTypeOut])
def list_document_types_full(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(DocumentType).order_by(DocumentType.name).all()


@router.get("/document-types-for-event", response_model=List[DocumentTypeOut])
def list_document_types_for_event(
    event_type_code: Optional[str] = None,
    stage: Optional[str] = "pre",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get document types applicable for a specific event type and stage (pre/post)."""
    q = db.query(DocumentType).filter(DocumentType.is_active == True, DocumentType.stage == stage)
    if event_type_code:
        from sqlalchemy import or_
        q = q.filter(or_(
            DocumentType.event_type_code == event_type_code,
            DocumentType.event_type_code.is_(None),
            DocumentType.event_type_code == '',
        ))
    return q.order_by(DocumentType.is_mandatory.desc(), DocumentType.name).all()


@router.post("/document-types", response_model=DocumentTypeOut)
def create_document_type(
    name: str,
    code: Optional[str] = None,
    event_type_code: Optional[str] = None,
    stage: Optional[str] = "pre",
    is_mandatory: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if code and db.query(DocumentType).filter(DocumentType.code == code).first():
        raise HTTPException(status_code=400, detail="Code already exists")
    dt = DocumentType(name=name, code=code, event_type_code=event_type_code, stage=stage, is_mandatory=is_mandatory)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return dt


@router.put("/document-types/{dt_id}", response_model=DocumentTypeOut)
def update_document_type(
    dt_id: int,
    name: Optional[str] = None,
    event_type_code: Optional[str] = None,
    stage: Optional[str] = None,
    is_mandatory: Optional[bool] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    dt = db.query(DocumentType).filter(DocumentType.id == dt_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    if name is not None:
        dt.name = name
    if event_type_code is not None:
        dt.event_type_code = event_type_code
    if stage is not None:
        dt.stage = stage
    if is_mandatory is not None:
        dt.is_mandatory = is_mandatory
    if is_active is not None:
        dt.is_active = is_active
    db.commit()
    db.refresh(dt)
    return dt


@router.delete("/document-types/{dt_id}")
def delete_document_type(dt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    dt = db.query(DocumentType).filter(DocumentType.id == dt_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Document type not found")
    db.delete(dt)
    db.commit()
    return {"ok": True}


# --- HCP Doctors full list (for Masters page) ---

@router.get("/hcp-doctors-all")
def list_all_hcp_doctors(
    q: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(HcpDoctor)
    if q:
        from sqlalchemy import or_
        like = f"%{q}%"
        query = query.filter(or_(
            HcpDoctor.full_name.ilike(like),
            HcpDoctor.uid_number.ilike(like),
            HcpDoctor.pan_number.ilike(like),
            HcpDoctor.email.ilike(like),
            HcpDoctor.city.ilike(like),
            HcpDoctor.mobile_number.ilike(like),
            HcpDoctor.speciality.ilike(like),
        ))
    if state:
        query = query.filter(HcpDoctor.state == state)
    doctors = query.order_by(HcpDoctor.full_name).offset(skip).limit(limit).all()
    result = []
    for doc in doctors:
        d = HcpDoctorOut.model_validate(doc).model_dump()
        d["divisions"] = [{"id": div.id, "name": div.name} for div in doc.divisions]
        result.append(d)
    return result
