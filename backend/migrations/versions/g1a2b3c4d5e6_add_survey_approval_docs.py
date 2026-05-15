"""add survey approval documents

Revision ID: g1a2b3c4d5e6
Revises: f9a0b1c2d3e4
Create Date: 2026-05-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'g1a2b3c4d5e6'
down_revision = 'f9a0b1c2d3e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('brs_surveys', sa.Column('approval_status', sa.String(50), server_default='Pending Approval'))
    op.add_column('brs_surveys', sa.Column('medical_approval_file', sa.String(500), nullable=True))
    op.add_column('brs_surveys', sa.Column('ethical_approval_file', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('brs_surveys', 'ethical_approval_file')
    op.drop_column('brs_surveys', 'medical_approval_file')
    op.drop_column('brs_surveys', 'approval_status')
