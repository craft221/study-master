"""Recalculate user levels with new Duolingo-style formula

Revision ID: recalculate_levels
Revises: add_leagues_social
Create Date: 2024-12-12

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'recalculate_levels'
down_revision: Union[str, None] = 'add_leagues_social'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def xp_for_next_level(level: int) -> int:
    """XP nécessaire pour passer du niveau actuel au suivant"""
    return 50 + (level * 25)


def calculate_level(xp: int) -> int:
    """Calcule le niveau basé sur l'XP total (nouvelle formule style Duolingo)"""
    if xp <= 0:
        return 1

    level = 1
    xp_needed = 0

    while True:
        xp_for_next = xp_for_next_level(level)
        if xp_needed + xp_for_next > xp:
            break
        xp_needed += xp_for_next
        level += 1

    return level


def upgrade() -> None:
    # Récupérer la connexion
    conn = op.get_bind()

    # Récupérer tous les user_gamification avec leur XP
    result = conn.execute(
        sa.text("SELECT id, total_xp, level FROM user_gamification")
    )
    rows = result.fetchall()

    print(f"Recalculating levels for {len(rows)} users...")

    updated_count = 0
    for row in rows:
        user_gam_id = row[0]
        total_xp = row[1] or 0
        old_level = row[2] or 1

        # Calculer le nouveau niveau
        new_level = calculate_level(total_xp)

        if new_level != old_level:
            conn.execute(
                sa.text("UPDATE user_gamification SET level = :level WHERE id = :id"),
                {"level": new_level, "id": user_gam_id}
            )
            updated_count += 1
            print(f"  User gamification {user_gam_id}: {total_xp} XP -> Level {old_level} -> {new_level}")

    print(f"Updated {updated_count} user levels.")

    # Afficher la nouvelle grille de niveaux pour référence
    print("\n=== Nouvelle grille de niveaux ===")
    print("Niveau | XP total requis | XP pour ce niveau")
    print("-" * 50)
    total = 0
    for lvl in range(1, 21):
        xp_needed = xp_for_next_level(lvl)
        total += xp_needed
        print(f"  {lvl:2d}   |    {total:5d}        |      {xp_needed:3d}")


def downgrade() -> None:
    # Recalculer avec l'ancienne formule (sqrt(xp / 100))
    import math

    conn = op.get_bind()

    result = conn.execute(
        sa.text("SELECT id, total_xp FROM user_gamification")
    )
    rows = result.fetchall()

    for row in rows:
        user_gam_id = row[0]
        total_xp = row[1] or 0

        # Ancienne formule
        if total_xp < 100:
            old_level = 1
        else:
            old_level = max(1, int(math.sqrt(total_xp / 100)))

        conn.execute(
            sa.text("UPDATE user_gamification SET level = :level WHERE id = :id"),
            {"level": old_level, "id": user_gam_id}
        )
