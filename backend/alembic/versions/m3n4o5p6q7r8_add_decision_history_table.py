"""Add decision_history table for AI training

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2025-12-10 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create decision type enum
    try:
        decisiontype = sa.Enum(
            'MATCH_SUGGESTED',
            'MATCH_SELECTED',
            'OWNER_CONFIRM',
            'OWNER_CORRECT_TABLE',
            'OWNER_DATA_NOT_EXIST',
            'OWNER_DELEGATE_PERSON',
            'OWNER_DELEGATE_AREA',
            'REQUESTER_APPROVE',
            'REQUESTER_REJECT_WRONG_DATA',
            'REQUESTER_REJECT_INCOMPLETE',
            'REQUESTER_REJECT_WRONG_GRANULARITY',
            'REQUESTER_REJECT_WRONG_PERIOD',
            'REQUESTER_REJECT_OTHER',
            'VARIABLE_IN_USE',
            'VARIABLE_CANCELLED',
            name='decisiontype'
        )
        decisiontype.create(op.get_bind(), checkfirst=True)
    except Exception:
        pass
    
    # Create decision outcome enum
    try:
        decisionoutcome = sa.Enum(
            'POSITIVE',
            'NEGATIVE',
            'NEUTRAL',
            name='decisionoutcome'
        )
        decisionoutcome.create(op.get_bind(), checkfirst=True)
    except Exception:
        pass
    
    # Add new statuses to variablesearchstatus enum
    try:
        op.execute("ALTER TYPE variablesearchstatus ADD VALUE IF NOT EXISTS 'IN_USE'")
        op.execute("ALTER TYPE variablesearchstatus ADD VALUE IF NOT EXISTS 'CANCELLED'")
    except Exception:
        pass
    
    # Create decision_history table
    op.create_table(
        'decision_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('variable_id', sa.Integer(), nullable=False),
        sa.Column('match_id', sa.Integer(), nullable=True),
        sa.Column('decision_type', sa.Enum(
            'MATCH_SUGGESTED', 'MATCH_SELECTED', 'OWNER_CONFIRM', 'OWNER_CORRECT_TABLE',
            'OWNER_DATA_NOT_EXIST', 'OWNER_DELEGATE_PERSON', 'OWNER_DELEGATE_AREA',
            'REQUESTER_APPROVE', 'REQUESTER_REJECT_WRONG_DATA', 'REQUESTER_REJECT_INCOMPLETE',
            'REQUESTER_REJECT_WRONG_GRANULARITY', 'REQUESTER_REJECT_WRONG_PERIOD', 'REQUESTER_REJECT_OTHER',
            'VARIABLE_IN_USE', 'VARIABLE_CANCELLED',
            name='decisiontype'
        ), nullable=False),
        sa.Column('outcome', sa.Enum('POSITIVE', 'NEGATIVE', 'NEUTRAL', name='decisionoutcome'), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('actor_role', sa.String(50), nullable=True),
        sa.Column('variable_context', sa.JSON(), nullable=True),
        sa.Column('table_context', sa.JSON(), nullable=True),
        sa.Column('match_context', sa.JSON(), nullable=True),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('decision_details', sa.JSON(), nullable=True),
        sa.Column('owner_response_id', sa.Integer(), nullable=True),
        sa.Column('requester_response_id', sa.Integer(), nullable=True),
        sa.Column('previous_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=True),
        sa.Column('loop_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ),
        sa.ForeignKeyConstraint(['variable_id'], ['case_variables.id'], ),
        sa.ForeignKeyConstraint(['match_id'], ['variable_matches.id'], ),
        sa.ForeignKeyConstraint(['actor_id'], ['collaborators.id'], ),
        sa.ForeignKeyConstraint(['owner_response_id'], ['owner_responses.id'], ),
        sa.ForeignKeyConstraint(['requester_response_id'], ['requester_responses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for efficient querying
    op.create_index(op.f('ix_decision_history_id'), 'decision_history', ['id'], unique=False)
    op.create_index(op.f('ix_decision_history_case_id'), 'decision_history', ['case_id'], unique=False)
    op.create_index(op.f('ix_decision_history_variable_id'), 'decision_history', ['variable_id'], unique=False)
    op.create_index(op.f('ix_decision_history_match_id'), 'decision_history', ['match_id'], unique=False)
    op.create_index(op.f('ix_decision_history_decision_type'), 'decision_history', ['decision_type'], unique=False)
    op.create_index(op.f('ix_decision_history_outcome'), 'decision_history', ['outcome'], unique=False)
    op.create_index(op.f('ix_decision_history_actor_id'), 'decision_history', ['actor_id'], unique=False)
    op.create_index(op.f('ix_decision_history_created_at'), 'decision_history', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_history_created_at'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_actor_id'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_outcome'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_decision_type'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_match_id'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_variable_id'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_case_id'), table_name='decision_history')
    op.drop_index(op.f('ix_decision_history_id'), table_name='decision_history')
    op.drop_table('decision_history')
