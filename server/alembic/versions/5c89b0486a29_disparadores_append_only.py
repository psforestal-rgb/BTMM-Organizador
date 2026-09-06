"""disparadores append only

DDL específico de SQLite (ADR 0003). Aísla el invariante 1 (un evento
nunca se modifica ni se borra) en la base de datos misma, para que no
dependa de la disciplina del código de aplicación.

Equivalente en PostgreSQL: una regla o un disparador con función
`RAISE EXCEPTION` sobre `BEFORE UPDATE OR DELETE ON evento`, por ejemplo

    CREATE FUNCTION evento_append_only() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'evento es append-only';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER evento_no_update BEFORE UPDATE ON evento
        FOR EACH ROW EXECUTE FUNCTION evento_append_only();
    CREATE TRIGGER evento_no_delete BEFORE DELETE ON evento
        FOR EACH ROW EXECUTE FUNCTION evento_append_only();

Revision ID: 5c89b0486a29
Revises: 10778a0c9a74
Create Date: 2026-09-06 17:11:41.847533

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5c89b0486a29'
down_revision: Union[str, None] = '10778a0c9a74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TRIGGER evento_no_update BEFORE UPDATE ON evento
        BEGIN SELECT RAISE(ABORT, 'evento es append-only'); END;
        """
    )
    op.execute(
        """
        CREATE TRIGGER evento_no_delete BEFORE DELETE ON evento
        BEGIN SELECT RAISE(ABORT, 'evento es append-only'); END;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS evento_no_update")
    op.execute("DROP TRIGGER IF EXISTS evento_no_delete")
