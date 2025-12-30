"""Add agent decision tables

Revision ID: f1a2b3c4d5e6
Revises: da147ff8e661
Create Date: 2025-12-08

Tables for Backend for Agents:
- decision_contexts: Context patterns for matching decisions
- agent_decisions: Individual decisions made by AI agents
- decision_consensus: Collective validation of decisions
- consensus_votes: Individual votes in consensus decisions
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'da147ff8e661'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums
    decision_type = sa.Enum(
        'VARIABLE_MATCH', 'CASE_CLASSIFICATION', 'RISK_ASSESSMENT', 
        'RECOMMENDATION', 'APPROVAL',
        name='decisiontype'
    )
    decision_status = sa.Enum(
        'PENDING', 'CONSENSUS_REQUIRED', 'APPROVED', 'REJECTED',
        name='decisionstatus'
    )
    consensus_status = sa.Enum(
        'VOTING', 'APPROVED', 'REJECTED', 'EXPIRED',
        name='consensusstatus'
    )
    
    decision_type.create(op.get_bind(), checkfirst=True)
    decision_status.create(op.get_bind(), checkfirst=True)
    consensus_status.create(op.get_bind(), checkfirst=True)
    
    # Create decision_contexts table
    op.create_table(
        'decision_contexts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('context_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('context_type', sa.String(50), nullable=False),
        sa.Column('context_data', JSON, nullable=False),
        sa.Column('domain', sa.String(100), nullable=True),
        sa.Column('entity_type', sa.String(100), nullable=True),
        sa.Column('concept', sa.String(255), nullable=True),
        sa.Column('total_decisions', sa.Integer(), server_default='0'),
        sa.Column('approved_decisions', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_decision_contexts_id', 'decision_contexts', ['id'])
    op.create_index('ix_decision_contexts_context_hash', 'decision_contexts', ['context_hash'], unique=True)
    op.create_index('ix_decision_contexts_context_type', 'decision_contexts', ['context_type'])
    op.create_index('ix_decision_contexts_domain', 'decision_contexts', ['domain'])
    op.create_index('ix_decision_contexts_concept', 'decision_contexts', ['concept'])
    
    # Create agent_decisions table
    op.create_table(
        'agent_decisions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('agent_version', sa.String(50), nullable=True),
        sa.Column('decision_type', decision_type, nullable=False),
        sa.Column('context_id', sa.Integer(), sa.ForeignKey('decision_contexts.id'), nullable=False),
        sa.Column('decision_value', JSON, nullable=False),
        sa.Column('confidence_score', sa.Float(), server_default='0.0'),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('status', decision_status, server_default="'PENDING'"),
        sa.Column('validated_by_id', sa.Integer(), sa.ForeignKey('collaborators.id'), nullable=True),
        sa.Column('validated_at', sa.DateTime(), nullable=True),
        sa.Column('related_case_id', sa.Integer(), sa.ForeignKey('cases.id'), nullable=True),
        sa.Column('related_variable_id', sa.Integer(), sa.ForeignKey('case_variables.id'), nullable=True),
        sa.Column('related_table_id', sa.Integer(), sa.ForeignKey('data_tables.id'), nullable=True),
        sa.Column('is_reused', sa.Boolean(), server_default='false'),
        sa.Column('source_decision_id', sa.Integer(), sa.ForeignKey('agent_decisions.id'), nullable=True),
        sa.Column('reuse_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_agent_decisions_id', 'agent_decisions', ['id'])
    op.create_index('ix_agent_decisions_agent_id', 'agent_decisions', ['agent_id'])
    op.create_index('ix_agent_decisions_decision_type', 'agent_decisions', ['decision_type'])
    op.create_index('ix_agent_decisions_context_id', 'agent_decisions', ['context_id'])
    op.create_index('ix_agent_decisions_status', 'agent_decisions', ['status'])
    op.create_index('ix_agent_decisions_status_type', 'agent_decisions', ['status', 'decision_type'])
    
    # Create decision_consensus table
    op.create_table(
        'decision_consensus',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('decision_id', sa.Integer(), sa.ForeignKey('agent_decisions.id'), nullable=False, unique=True),
        sa.Column('required_approvals', sa.Integer(), server_default='2'),
        sa.Column('voting_deadline', sa.DateTime(), nullable=False),
        sa.Column('approval_votes', sa.Integer(), server_default='0'),
        sa.Column('rejection_votes', sa.Integer(), server_default='0'),
        sa.Column('status', consensus_status, server_default="'VOTING'"),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_decision_consensus_id', 'decision_consensus', ['id'])
    op.create_index('ix_decision_consensus_status', 'decision_consensus', ['status'])
    
    # Create consensus_votes table
    op.create_table(
        'consensus_votes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('consensus_id', sa.Integer(), sa.ForeignKey('decision_consensus.id'), nullable=False),
        sa.Column('voter_id', sa.Integer(), sa.ForeignKey('collaborators.id'), nullable=False),
        sa.Column('vote', sa.Boolean(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('voted_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_consensus_votes_id', 'consensus_votes', ['id'])
    op.create_index('ix_consensus_votes_consensus_id', 'consensus_votes', ['consensus_id'])
    op.create_index('ix_consensus_votes_voter_id', 'consensus_votes', ['voter_id'])
    # Unique constraint to prevent double voting
    op.create_unique_constraint('uq_consensus_voter', 'consensus_votes', ['consensus_id', 'voter_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_constraint('uq_consensus_voter', 'consensus_votes', type_='unique')
    op.drop_index('ix_consensus_votes_voter_id', table_name='consensus_votes')
    op.drop_index('ix_consensus_votes_consensus_id', table_name='consensus_votes')
    op.drop_index('ix_consensus_votes_id', table_name='consensus_votes')
    op.drop_table('consensus_votes')
    
    op.drop_index('ix_decision_consensus_status', table_name='decision_consensus')
    op.drop_index('ix_decision_consensus_id', table_name='decision_consensus')
    op.drop_table('decision_consensus')
    
    op.drop_index('ix_agent_decisions_status_type', table_name='agent_decisions')
    op.drop_index('ix_agent_decisions_status', table_name='agent_decisions')
    op.drop_index('ix_agent_decisions_context_id', table_name='agent_decisions')
    op.drop_index('ix_agent_decisions_decision_type', table_name='agent_decisions')
    op.drop_index('ix_agent_decisions_agent_id', table_name='agent_decisions')
    op.drop_index('ix_agent_decisions_id', table_name='agent_decisions')
    op.drop_table('agent_decisions')
    
    op.drop_index('ix_decision_contexts_concept', table_name='decision_contexts')
    op.drop_index('ix_decision_contexts_domain', table_name='decision_contexts')
    op.drop_index('ix_decision_contexts_context_type', table_name='decision_contexts')
    op.drop_index('ix_decision_contexts_context_hash', table_name='decision_contexts')
    op.drop_index('ix_decision_contexts_id', table_name='decision_contexts')
    op.drop_table('decision_contexts')
    
    # Drop enums
    sa.Enum(name='consensusstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='decisionstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='decisiontype').drop(op.get_bind(), checkfirst=True)
