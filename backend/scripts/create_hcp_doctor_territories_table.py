"""
Temp script to create the hcp_doctor_territories table.
Run: python scripts/create_hcp_doctor_territories_table.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine, Base
from app.models.master import HcpDoctorTerritory

def create_table():
    """Create hcp_doctor_territories table if it doesn't exist."""
    HcpDoctorTerritory.__table__.create(engine, checkfirst=True)
    print("✓ Table 'hcp_doctor_territories' created (or already exists)")

if __name__ == "__main__":
    create_table()
