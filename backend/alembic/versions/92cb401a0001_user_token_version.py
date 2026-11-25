"""Revogação de sessões por versão, inclusive para usuários existentes."""
from alembic import op
import sqlalchemy as sa

revision = "92cb401a0001"
down_revision = "f08dcac4679c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("users", "token_version")
