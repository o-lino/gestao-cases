"""Add variable cancellation fields

Revision ID: g1h2i3j4k5l6
Revises: f1a2b3c4d5e6
Create Date: 2025-12-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add cancellation tracking columns to case_variables
    op.add_column('case_variables', sa.Column('is_cancelled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('case_variables', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('case_variables', sa.Column('cancelled_by', sa.Integer(), nullable=True))
    op.add_column('case_variables', sa.Column('cancellation_reason', sa.Text(), nullable=True))
    
    # Create foreign key for cancelled_by
    op.create_foreign_key(
        'fk_case_variables_cancelled_by',
        'case_variables',
        'collaborators',
        ['cancelled_by'],
        ['id']
    )
    
    # Create index for is_cancelled for faster queries
    op.create_index('ix_case_variables_is_cancelled', 'case_variables', ['is_cancelled'])


def downgrade() -> None:
    # Drop index and foreign key
    op.drop_index('ix_case_variables_is_cancelled', 'case_variables')
    op.drop_constraint('fk_case_variables_cancelled_by', 'case_variables', type_='foreignkey')
    
    # Drop columns
    op.drop_column('case_variables', 'cancellation_reason')
    op.drop_column('case_variables', 'cancelled_by')
    op.drop_column('case_variables', 'cancelled_at')
    op.drop_column('case_variables', 'is_cancelled')
