"""add compliance_approval_file to brs_surveys

Revision ID: k5e6f7g8h9i0
Revises: j4d5e6f7g8h9
Create Date: 2026-05-19 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k5e6f7g8h9i0'
down_revision: Union[str, None] = 'j4d5e6f7g8h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('brs_surveys', sa.Column('compliance_approval_file', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('brs_surveys', 'compliance_approval_file')
