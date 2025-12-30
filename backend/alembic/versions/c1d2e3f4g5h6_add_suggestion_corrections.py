"""add suggestion corrections table

Revision ID: c1d2e3f4g5h6
Revises: j1k2l3m4n5o6
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1d2e3f4g5h6'
down_revision = 'j1k2l3m4n5o6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create suggestion_corrections table
    op.create_table(
        'suggestion_corrections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('variable_id', sa.Integer(), nullable=False),
        sa.Column('original_table_id', sa.Integer(), nullable=True),
        sa.Column('original_score', sa.Float(), nullable=True),
        sa.Column('corrected_table_id', sa.Integer(), nullable=False),
        sa.Column('curator_id', sa.Integer(), nullable=False),
        sa.Column('correction_reason', sa.Text(), nullable=True),
        sa.Column('was_original_approved', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['variable_id'], ['case_variables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['original_table_id'], ['data_tables.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['corrected_table_id'], ['data_tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['curator_id'], ['collaborators.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suggestion_corrections_id'), 'suggestion_corrections', ['id'], unique=False)
    op.create_index(op.f('ix_suggestion_corrections_variable_id'), 'suggestion_corrections', ['variable_id'], unique=False)
    op.create_index(op.f('ix_suggestion_corrections_curator_id'), 'suggestion_corrections', ['curator_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_suggestion_corrections_curator_id'), table_name='suggestion_corrections')
    op.drop_index(op.f('ix_suggestion_corrections_variable_id'), table_name='suggestion_corrections')
    op.drop_index(op.f('ix_suggestion_corrections_id'), table_name='suggestion_corrections')
    op.drop_table('suggestion_corrections')
