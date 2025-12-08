"""add missing case fields

Revision ID: b2c3d4e5f6a7
Revises: ef0d52b2d047
Create Date: 2025-11-28 08:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'ef0d52b2d047'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing fields to cases table
    op.add_column('cases', sa.Column('requester_email', sa.String(), nullable=True))
    op.add_column('cases', sa.Column('macro_case', sa.String(), nullable=True))
    op.add_column('cases', sa.Column('context', sa.Text(), nullable=True))
    op.add_column('cases', sa.Column('impact', sa.Text(), nullable=True))
    op.add_column('cases', sa.Column('necessity', sa.Text(), nullable=True))
    op.add_column('cases', sa.Column('impacted_journey', sa.String(), nullable=True))
    op.add_column('cases', sa.Column('impacted_segment', sa.String(), nullable=True))
    op.add_column('cases', sa.Column('impacted_customers', sa.String(), nullable=True))
    
    # Add missing fields to case_variables table
    op.add_column('case_variables', sa.Column('product', sa.String(), nullable=True))
    op.add_column('case_variables', sa.Column('concept', sa.Text(), nullable=True))
    op.add_column('case_variables', sa.Column('min_history', sa.String(), nullable=True))
    op.add_column('case_variables', sa.Column('priority', sa.String(), nullable=True))
    op.add_column('case_variables', sa.Column('desired_lag', sa.String(), nullable=True))
    op.add_column('case_variables', sa.Column('options', sa.String(), nullable=True))
    
    # Rename audit_logs timestamp to created_at for consistency
    op.alter_column('audit_logs', 'timestamp', new_column_name='created_at')


def downgrade() -> None:
    # Rename created_at back to timestamp
    op.alter_column('audit_logs', 'created_at', new_column_name='timestamp')
    
    # Remove added columns from case_variables
    op.drop_column('case_variables', 'options')
    op.drop_column('case_variables', 'desired_lag')
    op.drop_column('case_variables', 'priority')
    op.drop_column('case_variables', 'min_history')
    op.drop_column('case_variables', 'concept')
    op.drop_column('case_variables', 'product')
    
    # Remove added columns from cases
    op.drop_column('cases', 'impacted_customers')
    op.drop_column('cases', 'impacted_segment')
    op.drop_column('cases', 'impacted_journey')
    op.drop_column('cases', 'necessity')
    op.drop_column('cases', 'impact')
    op.drop_column('cases', 'context')
    op.drop_column('cases', 'macro_case')
    op.drop_column('cases', 'requester_email')
