from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json

from app.db.base import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.job import BackgroundJob

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = 20,
):
    """List recent jobs for the current user (or all if admin)."""
    query = db.query(BackgroundJob).order_by(BackgroundJob.started_at.desc())
    if not current_user.is_superuser and current_user.role != "Administrator":
        query = query.filter(BackgroundJob.started_by_id == current_user.id)
    jobs = query.limit(limit).all()
    return [_job_to_dict(j) for j in jobs]


@router.get("/{job_id}")
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Get job status and progress."""
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return {"error": "Job not found"}
    return _job_to_dict(job)


def _job_to_dict(j):
    result = None
    if j.result_json:
        try:
            result = json.loads(j.result_json)
        except Exception:
            result = j.result_json
    return {
        "id": j.id,
        "job_type": j.job_type,
        "status": j.status,
        "progress": j.progress,
        "total": j.total,
        "message": j.message,
        "result": result,
        "error": j.error,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
    }
