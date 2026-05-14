"""make employee_id the login identifier, email no longer unique

Revision ID: b4e2f3a1c7d8
Revises: a3f1b2c4d5e6
Create Date: 2026-05-14 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b4e2f3a1c7d8'
down_revision: Union[str, None] = 'a3f1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove unique constraint on email
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=False)

    # Make email nullable
    op.alter_column('users', 'email', nullable=True)

    # Make employee_id NOT NULL (fill any nulls first)
    op.execute("UPDATE users SET employee_id = 'EMP' || id WHERE employee_id IS NULL")
    op.alter_column('users', 'employee_id', nullable=False)


def downgrade() -> None:
    op.alter_column('users', 'employee_id', nullable=True)
    op.alter_column('users', 'email', nullable=False)
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
