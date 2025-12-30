"""Merge heads and add agent decision tables

Revision ID: h1i2j3k4l5m6
Revises: 2270853bae17, g1h2i3j4k5l6
Create Date: 2025-12-08

This migration:
1. Merges the two heads (2270853bae17 and g1h2i3j4k5l6) into one
2. Adds agent decision tables that were missing
3. Adds missing FK constraint and index for case_variables cancellation columns
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'h1i2j3k4l5m6'
down_revision = ('2270853bae17', 'g1h2i3j4k5l6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the decision-related enums if they don't exist
    conn = op.get_bind()
    
    # Check and create enums
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE decisiontype AS ENUM (
                'VARIABLE_MATCH', 'CASE_CLASSIFICATION', 'RISK_ASSESSMENT', 
                'RECOMMENDATION', 'APPROVAL'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE decisionstatus AS ENUM (
                'PENDING', 'CONSENSUS_REQUIRED', 'APPROVED', 'REJECTED'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE consensusstatus AS ENUM (
                'VOTING', 'APPROVED', 'REJECTED', 'EXPIRED'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    # Create decision_contexts table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS decision_contexts (
            id SERIAL PRIMARY KEY,
            context_hash VARCHAR(64) NOT NULL UNIQUE,
            context_type VARCHAR(50) NOT NULL,
            context_data JSON NOT NULL,
            domain VARCHAR(100),
            entity_type VARCHAR(100),
            concept VARCHAR(255),
            total_decisions INTEGER DEFAULT 0,
            approved_decisions INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            last_used_at TIMESTAMP
        );
    """))
    
    # Create indexes for decision_contexts
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_contexts_id ON decision_contexts(id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_contexts_context_type ON decision_contexts(context_type);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_contexts_domain ON decision_contexts(domain);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_contexts_concept ON decision_contexts(concept);"))
    
    # Create agent_decisions table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS agent_decisions (
            id SERIAL PRIMARY KEY,
            agent_id VARCHAR(100) NOT NULL,
            agent_version VARCHAR(50),
            decision_type decisiontype NOT NULL,
            context_id INTEGER REFERENCES decision_contexts(id) NOT NULL,
            decision_value JSON NOT NULL,
            confidence_score FLOAT DEFAULT 0.0,
            reasoning TEXT,
            status decisionstatus DEFAULT 'PENDING',
            validated_by_id INTEGER REFERENCES collaborators(id),
            validated_at TIMESTAMP,
            related_case_id INTEGER REFERENCES cases(id),
            related_variable_id INTEGER REFERENCES case_variables(id),
            related_table_id INTEGER REFERENCES data_tables(id),
            is_reused BOOLEAN DEFAULT FALSE,
            source_decision_id INTEGER REFERENCES agent_decisions(id),
            reuse_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """))
    
    # Create indexes for agent_decisions
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_decisions_id ON agent_decisions(id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_decisions_agent_id ON agent_decisions(agent_id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_decisions_decision_type ON agent_decisions(decision_type);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_decisions_context_id ON agent_decisions(context_id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_decisions_status ON agent_decisions(status);"))
    
    # Create decision_consensus table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS decision_consensus (
            id SERIAL PRIMARY KEY,
            decision_id INTEGER REFERENCES agent_decisions(id) NOT NULL UNIQUE,
            required_approvals INTEGER DEFAULT 2,
            voting_deadline TIMESTAMP NOT NULL,
            approval_votes INTEGER DEFAULT 0,
            rejection_votes INTEGER DEFAULT 0,
            status consensusstatus DEFAULT 'VOTING',
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """))
    
    # Create indexes for decision_consensus
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_consensus_id ON decision_consensus(id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_decision_consensus_status ON decision_consensus(status);"))
    
    # Create consensus_votes table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS consensus_votes (
            id SERIAL PRIMARY KEY,
            consensus_id INTEGER REFERENCES decision_consensus(id) NOT NULL,
            voter_id INTEGER REFERENCES collaborators(id) NOT NULL,
            vote BOOLEAN NOT NULL,
            comment TEXT,
            voted_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(consensus_id, voter_id)
        );
    """))
    
    # Create indexes for consensus_votes
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_consensus_votes_id ON consensus_votes(id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_consensus_votes_consensus_id ON consensus_votes(consensus_id);"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_consensus_votes_voter_id ON consensus_votes(voter_id);"))
    
    # Add missing FK constraint for case_variables.cancelled_by if not exists
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE case_variables 
            ADD CONSTRAINT fk_case_variables_cancelled_by 
            FOREIGN KEY (cancelled_by) REFERENCES collaborators(id);
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    # Add missing index for is_cancelled if not exists
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_case_variables_is_cancelled ON case_variables(is_cancelled);"))


def downgrade() -> None:
    # Drop tables in reverse order
    op.execute("DROP TABLE IF EXISTS consensus_votes CASCADE;")
    op.execute("DROP TABLE IF EXISTS decision_consensus CASCADE;")
    op.execute("DROP TABLE IF EXISTS agent_decisions CASCADE;")
    op.execute("DROP TABLE IF EXISTS decision_contexts CASCADE;")
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS consensusstatus;")
    op.execute("DROP TYPE IF EXISTS decisionstatus;")
    op.execute("DROP TYPE IF EXISTS decisiontype;")
    
    # Drop FK constraint and index from case_variables
    op.execute("ALTER TABLE case_variables DROP CONSTRAINT IF EXISTS fk_case_variables_cancelled_by;")
    op.execute("DROP INDEX IF EXISTS ix_case_variables_is_cancelled;")
