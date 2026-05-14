"""convert user role column from enum to string

Revision ID: c5d6e7f8a9b0
Revises: b4e2f3a1c7d8
Create Date: 2026-05-14 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b4e2f3a1c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert the enum column to varchar(100)
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN role TYPE VARCHAR(100)
        USING role::text
    """)
    # Drop the old enum type
    op.execute("DROP TYPE IF EXISTS userrole")
    # Set default
    op.alter_column('users', 'role', server_default='User')


def downgrade() -> None:
    op.execute("CREATE TYPE userrole AS ENUM ('Administrator', 'ComplianceUser', 'DivisionCoOrdinator', 'FinanceUser', 'GSTuser', 'OPEXUser', 'User', 'FunctionalUser', 'MyAdmin', 'Anonymous', 'MarketingHead', 'DivisionHead')")
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN role TYPE userrole
        USING role::userrole
    """)
