
"""initial migration

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2025-11-26 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Collaborators
    op.create_table('collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='USER'),
        sa.Column('active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_collaborators_email'), 'collaborators', ['email'], unique=True)
    op.create_index(op.f('ix_collaborators_id'), 'collaborators', ['id'], unique=False)

    # Cases
    op.create_table('cases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='DRAFT'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('assigned_to_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('budget', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['collaborators.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cases_id'), 'cases', ['id'], unique=False)
    op.create_index(op.f('ix_cases_status'), 'cases', ['status'], unique=False)

    # Case Variables
    op.create_table('case_variables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('variable_name', sa.String(), nullable=False),
        sa.Column('variable_value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('variable_type', sa.String(), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=True, server_default='false'),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_id', 'variable_name', name='idx_case_var_unique')
    )
    op.create_index(op.f('ix_case_variables_id'), 'case_variables', ['id'], unique=False)
    # GIN Index for JSONB
    op.create_index('idx_case_vars_gin', 'case_variables', ['variable_value'], unique=False, postgresql_using='gin')

    # Audit Logs
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['actor_id'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index('idx_case_vars_gin', table_name='case_variables', postgresql_using='gin')
    op.drop_index(op.f('ix_case_variables_id'), table_name='case_variables')
    op.drop_table('case_variables')
    op.drop_index(op.f('ix_cases_status'), table_name='cases')
    op.drop_index(op.f('ix_cases_id'), table_name='cases')
    op.drop_table('cases')
    op.drop_index(op.f('ix_collaborators_id'), table_name='collaborators')
    op.drop_index(op.f('ix_collaborators_email'), table_name='collaborators')
    op.drop_table('collaborators')
