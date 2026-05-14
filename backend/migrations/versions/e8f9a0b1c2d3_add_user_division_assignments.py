"""add user_division_assignments table

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-05-14 04:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('user_division_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['division_id'], ['divisions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_division_assignments_id', 'user_division_assignments', ['id'], unique=False)
    op.create_index('ix_user_division_assignments_user_id', 'user_division_assignments', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_division_assignments_user_id', table_name='user_division_assignments')
    op.drop_index('ix_user_division_assignments_id', table_name='user_division_assignments')
    op.drop_table('user_division_assignments')
