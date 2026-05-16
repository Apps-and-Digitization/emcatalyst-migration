"""
Background Job Runner
=====================
Provides a simple threading-based background job system.
Any long-running task can be wrapped as a job function and executed via `run_job()`.

Usage:
    from app.services.job_runner import create_job, run_job

    # 1. Create the job record
    job = create_job(db, job_type="vendor_import", user_id=current_user.id)

    # 2. Define your task function (receives job_id, updates progress via DB)
    def my_task(job_id: int):
        db = SessionLocal()
        try:
            # ... do work in batches ...
            update_job_progress(db, job_id, progress=100, total=1000, message="Batch 1/10")
            # ... more work ...
            complete_job(db, job_id, result={"created": 500, "updated": 200})
        except Exception as e:
            fail_job(db, job_id, str(e))
        finally:
            db.close()

    # 3. Run it in background
    run_job(my_task, job.id)
"""
import threading
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.base import SessionLocal
from app.models.job import BackgroundJob


def create_job(db: Session, job_type: str, user_id: int = None, total: int = 0) -> BackgroundJob:
    """Create a new job record in pending state."""
    job = BackgroundJob(
        job_type=job_type,
        status="pending",
        progress=0,
        total=total,
        message="Starting...",
        started_by_id=user_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def run_job(task_fn, job_id: int):
    """Run a task function in a background thread."""
    thread = threading.Thread(target=task_fn, args=(job_id,), daemon=True)
    thread.start()


def update_job_progress(db: Session, job_id: int, progress: int, total: int = None, message: str = None):
    """Update job progress (call from within the task)."""
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return
    job.status = "running"
    job.progress = progress
    if total is not None:
        job.total = total
    if message is not None:
        job.message = message
    db.commit()


def complete_job(db: Session, job_id: int, result: dict = None):
    """Mark job as completed."""
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return
    job.status = "completed"
    job.progress = job.total if job.total else job.progress
    job.message = "Completed"
    job.completed_at = datetime.now(timezone.utc)
    if result:
        job.result_json = json.dumps(result)
    db.commit()


def fail_job(db: Session, job_id: int, error: str):
    """Mark job as failed."""
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return
    job.status = "failed"
    job.error = error
    job.message = f"Failed: {error[:200]}"
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
