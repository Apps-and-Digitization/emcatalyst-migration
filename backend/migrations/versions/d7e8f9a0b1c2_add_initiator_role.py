"""add initiator_role_id to approval_workflows

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b0
Create Date: 2026-05-14 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('approval_workflows', sa.Column('initiator_role_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_workflow_initiator_role', 'approval_workflows', 'roles', ['initiator_role_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_workflow_initiator_role', 'approval_workflows', type_='foreignkey')
    op.drop_column('approval_workflows', 'initiator_role_id')
