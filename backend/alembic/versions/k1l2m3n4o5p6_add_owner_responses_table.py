"""Add owner_responses table

Revision ID: k1l2m3n4o5p6
Revises: j1k2l3m4n5o6
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'k1l2m3n4o5p6'
down_revision = 'c1d2e3f4g5h6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create owner_response_type enum
    owner_response_type = sa.Enum(
        'CORRECT_TABLE',
        'DATA_NOT_EXIST', 
        'DELEGATE_PERSON',
        'DELEGATE_AREA',
        'CONFIRM_MATCH',
        name='ownerresponsetype'
    )
    try:
        owner_response_type.create(op.get_bind(), checkfirst=True)
    except sa.exc.ProgrammingError:
        pass # type likely exists
    
    # Create owner_responses table
    op.create_table(
        'owner_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('variable_match_id', sa.Integer(), nullable=False),
        sa.Column('response_type', sa.Enum(
            'CORRECT_TABLE',
            'DATA_NOT_EXIST',
            'DELEGATE_PERSON', 
            'DELEGATE_AREA',
            'CONFIRM_MATCH',
            name='ownerresponsetype'
        ), nullable=False),
        sa.Column('responder_id', sa.Integer(), nullable=False),
        sa.Column('suggested_table_id', sa.Integer(), nullable=True),
        sa.Column('delegate_to_funcional', sa.String(100), nullable=True),
        sa.Column('delegate_to_id', sa.Integer(), nullable=True),
        sa.Column('delegate_area_id', sa.Integer(), nullable=True),
        sa.Column('delegate_area_name', sa.String(255), nullable=True),
        sa.Column('usage_criteria', sa.Text(), nullable=True),
        sa.Column('attention_points', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_validated', sa.Boolean(), nullable=True, default=False),
        sa.Column('validation_result', sa.Text(), nullable=True),
        sa.Column('validation_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('validated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['variable_match_id'], ['variable_matches.id']),
        sa.ForeignKeyConstraint(['responder_id'], ['collaborators.id']),
        sa.ForeignKeyConstraint(['suggested_table_id'], ['data_tables.id']),
        sa.ForeignKeyConstraint(['delegate_to_id'], ['collaborators.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_owner_responses_id', 'owner_responses', ['id'])
    op.create_index('ix_owner_responses_variable_match_id', 'owner_responses', ['variable_match_id'])
    op.create_index('ix_owner_responses_response_type', 'owner_responses', ['response_type'])
    op.create_index('ix_owner_responses_responder_id', 'owner_responses', ['responder_id'])
    
    # Add new statuses to match_status enum
    # PostgreSQL requires dropping and recreating enum to add values
    # For SQLite (dev), this is automatic
    # Note: In production PostgreSQL, use ALTER TYPE ... ADD VALUE
    try:
        op.execute("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'REDIRECTED'")
        op.execute("ALTER TYPE matchstatus ADD VALUE IF NOT EXISTS 'PENDING_VALIDATION'")
    except Exception:
        # SQLite doesn't have enum types
        pass


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_owner_responses_responder_id', 'owner_responses')
    op.drop_index('ix_owner_responses_response_type', 'owner_responses')
    op.drop_index('ix_owner_responses_variable_match_id', 'owner_responses')
    op.drop_index('ix_owner_responses_id', 'owner_responses')
    
    # Drop table
    op.drop_table('owner_responses')
    
    # Drop enum type
    owner_response_type = sa.Enum(name='ownerresponsetype')
    owner_response_type.drop(op.get_bind(), checkfirst=True)
    
    # Note: Cannot remove enum values in PostgreSQL without recreating the type
