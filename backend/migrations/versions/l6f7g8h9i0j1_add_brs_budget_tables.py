"""add brs_budgets and brs_budget_audit_trail tables

Revision ID: l6f7g8h9i0j1
Revises: k5e6f7g8h9i0
Create Date: 2026-05-19 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l6f7g8h9i0j1'
down_revision: Union[str, None] = 'k5e6f7g8h9i0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'brs_budgets',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('division_id', sa.Integer(), sa.ForeignKey('divisions.id'), nullable=False),
        sa.Column('quarter', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('allocated_budget', sa.Numeric(14, 2), nullable=False),
        sa.Column('utilized_budget', sa.Numeric(14, 2), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'brs_budget_audit_trail',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('budget_id', sa.Integer(), sa.ForeignKey('brs_budgets.id'), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2)),
        sa.Column('description', sa.Text()),
        sa.Column('performed_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('brs_code', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('brs_budget_audit_trail')
    op.drop_table('brs_budgets')
