"""Add requester_responses table and update enums

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2025-12-10 23:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new values to matchstatus enum for requester workflow
    try:
        # PostgreSQL-specific syntax
        op.execute("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'PENDING_REQUESTER'")
        op.execute("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'REJECTED_BY_REQUESTER'")
    except Exception:
        # SQLite doesn't have enum types, so skip
        pass
    
    # Create requesterresponsetype enum
    try:
        requesterresponsetype = sa.Enum(
            'APPROVE',
            'REJECT_WRONG_DATA',
            'REJECT_INCOMPLETE',
            'REJECT_WRONG_GRANULARITY',
            'REJECT_WRONG_PERIOD',
            'REJECT_OTHER',
            name='requesterresponsetype'
        )
        requesterresponsetype.create(op.get_bind(), checkfirst=True)
    except Exception:
        pass
    
    # Add REQUESTER_REVIEW to variablesearchstatus enum
    try:
        op.execute("ALTER TYPE variablesearchstatus ADD VALUE IF NOT EXISTS 'REQUESTER_REVIEW'")
    except Exception:
        pass
    
    # Create requester_responses table
    op.create_table(
        'requester_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('variable_match_id', sa.Integer(), nullable=False),
        sa.Column('owner_response_id', sa.Integer(), nullable=True),
        sa.Column('response_type', sa.Enum('APPROVE', 'REJECT_WRONG_DATA', 'REJECT_INCOMPLETE', 'REJECT_WRONG_GRANULARITY', 'REJECT_WRONG_PERIOD', 'REJECT_OTHER', name='requesterresponsetype'), nullable=False),
        sa.Column('responder_id', sa.Integer(), nullable=False),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('expected_data_description', sa.Text(), nullable=True),
        sa.Column('improvement_suggestions', sa.Text(), nullable=True),
        sa.Column('is_validated', sa.Boolean(), default=False),
        sa.Column('validation_error', sa.Text(), nullable=True),
        sa.Column('loop_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['variable_match_id'], ['variable_matches.id'], ),
        sa.ForeignKeyConstraint(['owner_response_id'], ['owner_responses.id'], ),
        sa.ForeignKeyConstraint(['responder_id'], ['collaborators.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better query performance
    op.create_index(op.f('ix_requester_responses_id'), 'requester_responses', ['id'], unique=False)
    op.create_index(op.f('ix_requester_responses_variable_match_id'), 'requester_responses', ['variable_match_id'], unique=False)
    op.create_index(op.f('ix_requester_responses_owner_response_id'), 'requester_responses', ['owner_response_id'], unique=False)
    op.create_index(op.f('ix_requester_responses_response_type'), 'requester_responses', ['response_type'], unique=False)
    op.create_index(op.f('ix_requester_responses_responder_id'), 'requester_responses', ['responder_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_requester_responses_responder_id'), table_name='requester_responses')
    op.drop_index(op.f('ix_requester_responses_response_type'), table_name='requester_responses')
    op.drop_index(op.f('ix_requester_responses_owner_response_id'), table_name='requester_responses')
    op.drop_index(op.f('ix_requester_responses_variable_match_id'), table_name='requester_responses')
    op.drop_index(op.f('ix_requester_responses_id'), table_name='requester_responses')
    op.drop_table('requester_responses')
    
    # Note: Cannot easily remove enum values in PostgreSQL
