"""Add hierarchy and approval tables

Revision ID: j1k2l3m4n5o6
Revises: i1j2k3l4m5n6
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'j1k2l3m4n5o6'
down_revision = 'i1j2k3l4m5n6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create organizational_hierarchy table
    op.create_table(
        'organizational_hierarchy',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('collaborator_id', sa.Integer(), nullable=False),
        sa.Column('supervisor_id', sa.Integer(), nullable=True),
        sa.Column('job_level', sa.Integer(), nullable=False, default=1),
        sa.Column('job_title', sa.String(length=100), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('cost_center', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['collaborator_id'], ['collaborators.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supervisor_id'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('collaborator_id')
    )
    op.create_index(op.f('ix_organizational_hierarchy_id'), 'organizational_hierarchy', ['id'], unique=False)
    op.create_index(op.f('ix_organizational_hierarchy_department'), 'organizational_hierarchy', ['department'], unique=False)
    op.create_index(op.f('ix_organizational_hierarchy_job_level'), 'organizational_hierarchy', ['job_level'], unique=False)

    # Create system_configurations table
    op.create_table(
        'system_configurations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_key', sa.String(length=100), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=False),
        sa.Column('config_type', sa.String(length=20), nullable=True, default='string'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True, default='general'),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['updated_by'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('config_key')
    )
    op.create_index(op.f('ix_system_configurations_id'), 'system_configurations', ['id'], unique=False)
    op.create_index(op.f('ix_system_configurations_config_key'), 'system_configurations', ['config_key'], unique=True)
    op.create_index(op.f('ix_system_configurations_category'), 'system_configurations', ['category'], unique=False)

    # Create pending_approvals table
    op.create_table(
        'pending_approvals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.Integer(), nullable=False),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('escalation_level', sa.Integer(), nullable=True, default=0),
        sa.Column('previous_approval_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='PENDING'),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('sla_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_notes', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('reminder_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_count', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['collaborators.id'], ),
        sa.ForeignKeyConstraint(['requester_id'], ['collaborators.id'], ),
        sa.ForeignKeyConstraint(['previous_approval_id'], ['pending_approvals.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pending_approvals_id'), 'pending_approvals', ['id'], unique=False)
    op.create_index(op.f('ix_pending_approvals_status'), 'pending_approvals', ['status'], unique=False)
    op.create_index(op.f('ix_pending_approvals_approver_id'), 'pending_approvals', ['approver_id'], unique=False)
    op.create_index(op.f('ix_pending_approvals_case_id'), 'pending_approvals', ['case_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pending_approvals_case_id'), table_name='pending_approvals')
    op.drop_index(op.f('ix_pending_approvals_approver_id'), table_name='pending_approvals')
    op.drop_index(op.f('ix_pending_approvals_status'), table_name='pending_approvals')
    op.drop_index(op.f('ix_pending_approvals_id'), table_name='pending_approvals')
    op.drop_table('pending_approvals')
    
    op.drop_index(op.f('ix_system_configurations_category'), table_name='system_configurations')
    op.drop_index(op.f('ix_system_configurations_config_key'), table_name='system_configurations')
    op.drop_index(op.f('ix_system_configurations_id'), table_name='system_configurations')
    op.drop_table('system_configurations')
    
    op.drop_index(op.f('ix_organizational_hierarchy_job_level'), table_name='organizational_hierarchy')
    op.drop_index(op.f('ix_organizational_hierarchy_department'), table_name='organizational_hierarchy')
    op.drop_index(op.f('ix_organizational_hierarchy_id'), table_name='organizational_hierarchy')
    op.drop_table('organizational_hierarchy')
