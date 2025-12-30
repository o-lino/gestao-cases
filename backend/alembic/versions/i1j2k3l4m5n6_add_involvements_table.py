"""Add involvements table

Revision ID: i1j2k3l4m5n6
Revises: h1i2j3k4l5m6
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i1j2k3l4m5n6'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create involvements table
    op.create_table(
        'involvements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_variable_id', sa.Integer(), nullable=False),
        sa.Column('external_request_number', sa.String(length=100), nullable=False),
        sa.Column('external_system', sa.String(length=100), nullable=True),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('expected_completion_date', sa.Date(), nullable=True),
        sa.Column('actual_completion_date', sa.Date(), nullable=True),
        sa.Column('created_table_name', sa.String(length=255), nullable=True),
        sa.Column('created_concept', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', name='involvementstatus'), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('last_reminder_at', sa.DateTime(), nullable=True),
        sa.Column('reminder_count', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['case_variable_id'], ['case_variables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requester_id'], ['collaborators.id'], ),
        sa.ForeignKeyConstraint(['owner_id'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_involvements_id'), 'involvements', ['id'], unique=False)
    op.create_index(op.f('ix_involvements_case_variable_id'), 'involvements', ['case_variable_id'], unique=False)
    op.create_index(op.f('ix_involvements_status'), 'involvements', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_involvements_status'), table_name='involvements')
    op.drop_index(op.f('ix_involvements_case_variable_id'), table_name='involvements')
    op.drop_index(op.f('ix_involvements_id'), table_name='involvements')
    op.drop_table('involvements')
    
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS involvementstatus')
