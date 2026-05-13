"""change question_type from enum to string and add fill_in_blanks

Revision ID: a3f1b2c4d5e6
Revises: 1319a2c257ce
Create Date: 2026-05-13 23:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f1b2c4d5e6'
down_revision: Union[str, None] = '1319a2c257ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert the enum column to varchar(50)
    op.execute("""
        ALTER TABLE brs_survey_questions
        ALTER COLUMN question_type TYPE VARCHAR(50)
        USING question_type::text
    """)
    # Drop the old enum type
    op.execute("DROP TYPE IF EXISTS brsquestiontype")


def downgrade() -> None:
    # Recreate enum type
    op.execute("CREATE TYPE brsquestiontype AS ENUM ('dropdown', 'single_select', 'multi_select', 'free_text', 'video')")
    op.execute("""
        ALTER TABLE brs_survey_questions
        ALTER COLUMN question_type TYPE brsquestiontype
        USING question_type::brsquestiontype
    """)
