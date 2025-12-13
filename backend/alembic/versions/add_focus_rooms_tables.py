"""Add Focus Rooms tables for virtual study rooms (body doubling)

Revision ID: add_focus_rooms_tables
Revises: add_documents_table
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_focus_rooms_tables'
down_revision = 'add_documents_table'
branch_labels = None
depends_on = None

# Define enum types with create_type=False to prevent auto-creation
focusroomtype = postgresql.ENUM('public', 'subject', 'university', 'private', 'event', name='focusroomtype', create_type=False)
focusroomcategory = postgresql.ENUM('general', 'sciences', 'humanities', 'languages', 'business', 'technology', 'medicine', 'law', 'other', name='focusroomcategory', create_type=False)
participantstatus = postgresql.ENUM('focusing', 'break', 'idle', 'away', name='participantstatus', create_type=False)
focusactivitytype = postgresql.ENUM('user_joined', 'user_left', 'milestone_30min', 'milestone_1h', 'milestone_2h', 'milestone_3h', 'quiz_completed', 'flashcards_completed', 'streak_achieved', 'first_today', 'status_changed', 'poke_sent', name='focusactivitytype', create_type=False)
invitationstatus = postgresql.ENUM('pending', 'accepted', 'declined', 'expired', name='invitationstatus', create_type=False)


def upgrade():
    conn = op.get_bind()

    # Check which tables already exist
    result = conn.execute(sa.text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """))
    existing_tables = [row[0] for row in result]

    # ==================== CREATE ENUM TYPES ====================
    # Check and create focusroomtype enum
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'focusroomtype'
    """))
    if not enum_result.fetchone():
        focusroomtype.create(conn)

    # Check and create focusroomcategory enum
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'focusroomcategory'
    """))
    if not enum_result.fetchone():
        focusroomcategory.create(conn)

    # Check and create participantstatus enum
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'participantstatus'
    """))
    if not enum_result.fetchone():
        participantstatus.create(conn)

    # Check and create focusactivitytype enum
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'focusactivitytype'
    """))
    if not enum_result.fetchone():
        focusactivitytype.create(conn)

    # Check and create invitationstatus enum
    enum_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_type WHERE typname = 'invitationstatus'
    """))
    if not enum_result.fetchone():
        invitationstatus.create(conn)

    # ==================== FOCUS_ROOMS TABLE ====================
    if 'focus_rooms' not in existing_tables:
        op.create_table('focus_rooms',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('emoji', sa.String(10), server_default='📚', nullable=True),
            sa.Column('room_type', focusroomtype, server_default='public', nullable=False),
            sa.Column('category', focusroomcategory, server_default='general', nullable=False),
            sa.Column('subject_id', sa.Integer(), nullable=True),
            sa.Column('university', sa.String(200), nullable=True),
            sa.Column('promotion', sa.String(50), nullable=True),
            sa.Column('max_participants', sa.Integer(), server_default='100', nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('is_private', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('invite_code', sa.String(8), nullable=True),
            sa.Column('creator_id', sa.Integer(), nullable=False),
            sa.Column('total_focus_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_sessions', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_unique_users', sa.Integer(), server_default='0', nullable=True),
            sa.Column('peak_participants', sa.Integer(), server_default='0', nullable=True),
            sa.Column('today_focus_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('today_sessions', sa.Integer(), server_default='0', nullable=True),
            sa.Column('stats_reset_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_focus_rooms_id', 'focus_rooms', ['id'])
        op.create_index('ix_focus_rooms_invite_code', 'focus_rooms', ['invite_code'], unique=True)
        op.create_index('ix_focus_rooms_type_active', 'focus_rooms', ['room_type', 'is_active'])
        op.create_index('ix_focus_rooms_university', 'focus_rooms', ['university'])
        op.create_index('ix_focus_rooms_category', 'focus_rooms', ['category'])

    # ==================== FOCUS_ROOM_PARTICIPANTS TABLE ====================
    if 'focus_room_participants' not in existing_tables:
        op.create_table('focus_room_participants',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('room_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('status', participantstatus, server_default='focusing', nullable=False),
            sa.Column('current_activity', sa.String(200), nullable=True),
            sa.Column('current_subject_id', sa.Integer(), nullable=True),
            sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('last_activity_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('last_heartbeat_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('focus_started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('break_started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('current_focus_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('current_break_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('today_focus_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('today_sessions_count', sa.Integer(), server_default='0', nullable=True),
            sa.Column('milestones_reached', sa.JSON(), nullable=True),
            sa.Column('is_visible', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('show_activity', sa.Boolean(), server_default='true', nullable=True),
            sa.ForeignKeyConstraint(['room_id'], ['focus_rooms.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['current_subject_id'], ['subjects.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', name='uq_participant_user_one_room')
        )
        op.create_index('ix_focus_room_participants_id', 'focus_room_participants', ['id'])
        op.create_index('ix_focus_room_participants_room_id', 'focus_room_participants', ['room_id'])
        op.create_index('ix_focus_room_participants_user_id', 'focus_room_participants', ['user_id'])
        op.create_index('ix_focus_participant_status', 'focus_room_participants', ['status'])

    # ==================== FOCUS_SESSIONS TABLE ====================
    if 'focus_sessions' not in existing_tables:
        op.create_table('focus_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('room_id', sa.Integer(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('subject_id', sa.Integer(), nullable=True),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('focus_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('break_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('focus_score', sa.Integer(), nullable=True),
            sa.Column('activities_completed', sa.Integer(), server_default='0', nullable=True),
            sa.Column('milestones_reached', sa.JSON(), nullable=True),
            sa.Column('xp_earned', sa.Integer(), server_default='0', nullable=True),
            sa.Column('xp_bonus', sa.Integer(), server_default='0', nullable=True),
            sa.Column('room_name', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['room_id'], ['focus_rooms.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_focus_sessions_id', 'focus_sessions', ['id'])
        op.create_index('ix_focus_sessions_room_id', 'focus_sessions', ['room_id'])
        op.create_index('ix_focus_sessions_user_id', 'focus_sessions', ['user_id'])
        op.create_index('ix_focus_session_user_date', 'focus_sessions', ['user_id', 'started_at'])

    # ==================== FOCUS_ROOM_ACTIVITIES TABLE ====================
    if 'focus_room_activities' not in existing_tables:
        op.create_table('focus_room_activities',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('room_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('activity_type', focusactivitytype, nullable=False),
            sa.Column('message', sa.String(500), nullable=True),
            sa.Column('extra_data', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['room_id'], ['focus_rooms.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_focus_room_activities_id', 'focus_room_activities', ['id'])
        op.create_index('ix_focus_room_activities_room_id', 'focus_room_activities', ['room_id'])
        op.create_index('ix_focus_room_activities_created_at', 'focus_room_activities', ['created_at'])

    # ==================== FOCUS_ROOM_INVITATIONS TABLE ====================
    if 'focus_room_invitations' not in existing_tables:
        op.create_table('focus_room_invitations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('room_id', sa.Integer(), nullable=False),
            sa.Column('inviter_id', sa.Integer(), nullable=False),
            sa.Column('invitee_id', sa.Integer(), nullable=False),
            sa.Column('status', invitationstatus, server_default='pending', nullable=False),
            sa.Column('message', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['room_id'], ['focus_rooms.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['inviter_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['invitee_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_focus_room_invitations_id', 'focus_room_invitations', ['id'])
        op.create_index('ix_focus_room_invitations_room_id', 'focus_room_invitations', ['room_id'])
        op.create_index('ix_focus_room_invitations_invitee_id', 'focus_room_invitations', ['invitee_id'])
        op.create_index('ix_invitation_invitee_status', 'focus_room_invitations', ['invitee_id', 'status'])

    # ==================== FOCUS_ROOM_POKES TABLE ====================
    if 'focus_room_pokes' not in existing_tables:
        op.create_table('focus_room_pokes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('room_id', sa.Integer(), nullable=False),
            sa.Column('from_user_id', sa.Integer(), nullable=False),
            sa.Column('to_user_id', sa.Integer(), nullable=False),
            sa.Column('message', sa.String(200), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['room_id'], ['focus_rooms.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_focus_room_pokes_id', 'focus_room_pokes', ['id'])

    # ==================== USER_FOCUS_ROOM_STATS TABLE ====================
    if 'user_focus_room_stats' not in existing_tables:
        op.create_table('user_focus_room_stats',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('total_focus_room_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_focus_room_sessions', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_rooms_joined', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_rooms_created', sa.Integer(), server_default='0', nullable=True),
            sa.Column('focus_room_streak_days', sa.Integer(), server_default='0', nullable=True),
            sa.Column('best_focus_room_streak', sa.Integer(), server_default='0', nullable=True),
            sa.Column('last_focus_room_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('longest_session_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('best_focus_score', sa.Integer(), server_default='0', nullable=True),
            sa.Column('favorite_room_id', sa.Integer(), nullable=True),
            sa.Column('favorite_room_minutes', sa.Integer(), server_default='0', nullable=True),
            sa.Column('preferred_hour', sa.Integer(), nullable=True),
            sa.Column('total_xp_earned', sa.Integer(), server_default='0', nullable=True),
            sa.Column('total_xp_bonus', sa.Integer(), server_default='0', nullable=True),
            sa.Column('focus_room_achievements', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['favorite_room_id'], ['focus_rooms.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id')
        )
        op.create_index('ix_user_focus_room_stats_id', 'user_focus_room_stats', ['id'])
        op.create_index('ix_user_focus_room_stats_user_id', 'user_focus_room_stats', ['user_id'])


def downgrade():
    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table('user_focus_room_stats')
    op.drop_table('focus_room_pokes')
    op.drop_table('focus_room_invitations')
    op.drop_table('focus_room_activities')
    op.drop_table('focus_sessions')
    op.drop_table('focus_room_participants')
    op.drop_table('focus_rooms')

    # Drop enum types
    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS invitationstatus"))
    conn.execute(sa.text("DROP TYPE IF EXISTS focusactivitytype"))
    conn.execute(sa.text("DROP TYPE IF EXISTS participantstatus"))
    conn.execute(sa.text("DROP TYPE IF EXISTS focusroomcategory"))
    conn.execute(sa.text("DROP TYPE IF EXISTS focusroomtype"))
