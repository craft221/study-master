"""
Service Focus Room - Logique metier pour les salles d'etude virtuelles
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload, joinedload

from app.models.focus_room import (
    FocusRoom, FocusRoomParticipant, FocusSession,
    FocusRoomActivity, FocusRoomInvitation, FocusRoomPoke,
    UserFocusRoomStats, FocusRoomType, FocusRoomCategory,
    ParticipantStatus, FocusActivityType, InvitationStatus
)
from app.models.user import User
from app.models.subject import Subject
from app.schemas.focus_room import (
    FocusRoomCreate, FocusRoomUpdate, FocusRoomResponse,
    ParticipantResponse, ActivityResponse, RoomStatsResponse,
    UserFocusStatsResponse, LeaderboardEntry
)
from app.services.cache_service import cache_service
from app.services.xp_service import award_xp
from app.services.notification_service import notification_service
from app.core.datetime_utils import utc_now, days_ago, utc_today

logger = logging.getLogger(__name__)


# XP Rewards
XP_REWARDS = {
    "create_room": 30,
    "join_room": 5,
    "focus_minute": 1,
    "room_bonus_percent": 20,  # 20% bonus
    # Milestones (alignés avec le frontend StreakTracker)
    "milestone_15min": 10,
    "milestone_30min": 25,
    "milestone_45min": 40,
    "milestone_1h": 60,
    "milestone_90min": 100,
    "milestone_2h": 150,
    "milestone_3h": 250,
    "milestone_4h": 400,
    "invitation_accepted": 5,  # Pour l'inviteur
    "first_to_1h": 10,
    "deep_work_completed": 50,  # Bonus pour compléter 90min de deep work
}


class FocusRoomService:
    """Service pour la gestion des Focus Rooms"""

    # ==================== ROOM CRUD ====================

    async def create_room(
        self,
        db: AsyncSession,
        user: User,
        room_data: FocusRoomCreate
    ) -> FocusRoom:
        """Cree une nouvelle room"""
        # Creer la room
        room = FocusRoom(
            name=room_data.name,
            description=room_data.description,
            emoji=room_data.emoji,
            room_type=room_data.room_type,
            category=room_data.category,
            max_participants=room_data.max_participants,
            subject_id=room_data.subject_id,
            university=room_data.university,
            promotion=room_data.promotion,
            is_private=room_data.is_private or room_data.room_type == FocusRoomType.PRIVATE,
            creator_id=user.id,
            starts_at=room_data.starts_at,
            ends_at=room_data.ends_at,
        )

        # Generer code d'invitation si room privee
        if room.is_private:
            room.generate_invite_code()

        db.add(room)
        await db.commit()
        await db.refresh(room)

        # Mettre a jour les stats utilisateur
        await self._update_user_focus_stats(db, user.id, rooms_created=1)

        # Attribuer XP
        await award_xp(
            user=user,
            amount=XP_REWARDS["create_room"],
            reason="focus_room_created",
            extra_data={"room_id": room.id}
        )

        logger.info(f"Room created: {room.name} by user {user.id}")
        return room

    async def get_room(
        self,
        db: AsyncSession,
        room_id: int,
        include_participants: bool = False
    ) -> Optional[FocusRoom]:
        """Recupere une room par ID"""
        query = select(FocusRoom).where(FocusRoom.id == room_id)

        if include_participants:
            query = query.options(
                selectinload(FocusRoom.participants).selectinload(FocusRoomParticipant.user),
                selectinload(FocusRoom.creator),
                selectinload(FocusRoom.subject)
            )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def list_rooms(
        self,
        db: AsyncSession,
        room_type: Optional[FocusRoomType] = None,
        category: Optional[FocusRoomCategory] = None,
        university: Optional[str] = None,
        subject_id: Optional[int] = None,
        search: Optional[str] = None,
        hide_empty: bool = False,
        hide_full: bool = False,
        sort_by: str = "active_participants",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None
    ) -> Tuple[List[FocusRoom], int]:
        """Liste les rooms avec filtres"""
        query = select(FocusRoom).where(FocusRoom.is_active == True)

        # Filtres
        if room_type:
            query = query.where(FocusRoom.room_type == room_type)
        if category:
            query = query.where(FocusRoom.category == category)
        if university:
            query = query.where(FocusRoom.university.ilike(f"%{university}%"))
        if subject_id:
            query = query.where(FocusRoom.subject_id == subject_id)
        if search:
            query = query.where(
                or_(
                    FocusRoom.name.ilike(f"%{search}%"),
                    FocusRoom.description.ilike(f"%{search}%")
                )
            )

        # Exclure rooms privees sauf si on est createur ou invite
        if user_id:
            # Sous-requête pour trouver les rooms où l'utilisateur a une invitation
            invited_rooms_subquery = select(FocusRoomInvitation.room_id).where(
                and_(
                    FocusRoomInvitation.invitee_id == user_id,
                    FocusRoomInvitation.status.in_([InvitationStatus.PENDING, InvitationStatus.ACCEPTED])
                )
            )
            query = query.where(
                or_(
                    FocusRoom.is_private == False,
                    FocusRoom.creator_id == user_id,
                    FocusRoom.id.in_(invited_rooms_subquery)
                )
            )
        else:
            query = query.where(FocusRoom.is_private == False)

        # Compter le total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Tri
        if sort_by == "created_at":
            order = desc(FocusRoom.created_at) if sort_order == "desc" else asc(FocusRoom.created_at)
        elif sort_by == "name":
            order = desc(FocusRoom.name) if sort_order == "desc" else asc(FocusRoom.name)
        else:  # active_participants par defaut
            # On triera en Python car besoin de compter les participants
            order = desc(FocusRoom.created_at)

        query = query.order_by(order)
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.creator),
            selectinload(FocusRoom.subject)
        )

        result = await db.execute(query)
        rooms = list(result.scalars().all())

        # Filtrer par nombre de participants si necessaire
        if hide_empty:
            rooms = [r for r in rooms if len([p for p in r.participants if p.status != ParticipantStatus.IDLE]) > 0]
        if hide_full:
            rooms = [r for r in rooms if len(r.participants) < r.max_participants]

        # Trier par participants actifs
        if sort_by == "active_participants":
            rooms.sort(
                key=lambda r: len([p for p in r.participants if p.status == ParticipantStatus.FOCUSING]),
                reverse=(sort_order == "desc")
            )

        return rooms, total

    async def get_my_rooms(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[FocusRoom]:
        """Recupere les rooms de l'utilisateur (creees et recemment rejointes)"""
        # Rooms creees
        created_query = select(FocusRoom).where(
            and_(
                FocusRoom.creator_id == user_id,
                FocusRoom.is_active == True
            )
        ).options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.subject)
        )

        # Sessions recentes (dernieres 7 jours)
        week_ago = utc_now() - timedelta(days=7)
        recent_sessions = select(FocusSession.room_id).where(
            and_(
                FocusSession.user_id == user_id,
                FocusSession.started_at >= week_ago
            )
        ).distinct()

        recent_query = select(FocusRoom).where(
            and_(
                FocusRoom.id.in_(recent_sessions),
                FocusRoom.is_active == True,
                FocusRoom.creator_id != user_id  # Eviter doublons
            )
        ).options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.subject)
        )

        created_result = await db.execute(created_query)
        recent_result = await db.execute(recent_query)

        created_rooms = list(created_result.scalars().all())
        recent_rooms = list(recent_result.scalars().all())

        return created_rooms + recent_rooms

    async def get_popular_rooms(
        self,
        db: AsyncSession,
        limit: int = 10
    ) -> List[FocusRoom]:
        """Recupere les rooms les plus populaires"""
        query = select(FocusRoom).where(
            and_(
                FocusRoom.is_active == True,
                FocusRoom.is_private == False
            )
        ).options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.creator),
            selectinload(FocusRoom.subject)
        ).order_by(desc(FocusRoom.today_sessions)).limit(limit)

        result = await db.execute(query)
        rooms = list(result.scalars().all())

        # Trier par participants actifs
        rooms.sort(
            key=lambda r: len([p for p in r.participants if p.status == ParticipantStatus.FOCUSING]),
            reverse=True
        )

        return rooms

    async def get_recommended_rooms(
        self,
        db: AsyncSession,
        user: User,
        limit: int = 10
    ) -> List[FocusRoom]:
        """Recupere les rooms recommandees pour l'utilisateur"""
        rooms = []

        # 1. Rooms de la meme universite
        if user.profile and user.profile.university:
            univ_query = select(FocusRoom).where(
                and_(
                    FocusRoom.is_active == True,
                    FocusRoom.is_private == False,
                    FocusRoom.university == user.profile.university
                )
            ).options(
                selectinload(FocusRoom.participants),
                selectinload(FocusRoom.creator)
            ).limit(5)
            result = await db.execute(univ_query)
            rooms.extend(list(result.scalars().all()))

        # 2. Rooms des matieres de l'utilisateur
        user_subjects = await db.execute(
            select(Subject.id).where(Subject.user_id == user.id)
        )
        subject_ids = [s[0] for s in user_subjects.fetchall()]

        if subject_ids:
            subj_query = select(FocusRoom).where(
                and_(
                    FocusRoom.is_active == True,
                    FocusRoom.is_private == False,
                    FocusRoom.subject_id.in_(subject_ids)
                )
            ).options(
                selectinload(FocusRoom.participants),
                selectinload(FocusRoom.creator),
                selectinload(FocusRoom.subject)
            ).limit(5)
            result = await db.execute(subj_query)
            rooms.extend(list(result.scalars().all()))

        # Deduplication et tri
        seen = set()
        unique_rooms = []
        for room in rooms:
            if room.id not in seen:
                seen.add(room.id)
                unique_rooms.append(room)

        # Trier par activite
        unique_rooms.sort(
            key=lambda r: len([p for p in r.participants if p.status == ParticipantStatus.FOCUSING]),
            reverse=True
        )

        return unique_rooms[:limit]

    async def update_room(
        self,
        db: AsyncSession,
        room: FocusRoom,
        update_data: FocusRoomUpdate
    ) -> FocusRoom:
        """Met a jour une room"""
        update_dict = update_data.model_dump(exclude_unset=True)

        for key, value in update_dict.items():
            setattr(room, key, value)

        await db.commit()
        await db.refresh(room)
        return room

    async def delete_room(
        self,
        db: AsyncSession,
        room: FocusRoom
    ) -> bool:
        """Supprime une room (soft delete)"""
        room.is_active = False
        await db.commit()
        return True

    # ==================== PARTICIPATION ====================

    async def join_room(
        self,
        db: AsyncSession,
        user: User,
        room: FocusRoom,
        activity: Optional[str] = None,
        subject_id: Optional[int] = None,
        is_visible: bool = True,
        invite_code: Optional[str] = None
    ) -> FocusRoomParticipant:
        """Rejoindre une room"""
        # Verifier si deja dans une room
        existing = await db.execute(
            select(FocusRoomParticipant).where(
                FocusRoomParticipant.user_id == user.id
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("already_in_room")

        # Verifier si room pleine
        active_count = len([p for p in room.participants if p.status != ParticipantStatus.IDLE])
        if active_count >= room.max_participants:
            raise ValueError("room_is_full")

        # Verifier acces room privee
        if room.is_private:
            # Le créateur peut toujours rejoindre sa propre room
            is_creator = room.creator_id == user.id

            # Vérifier le code d'invitation ou une invitation existante
            has_valid_code = invite_code and invite_code.upper() == room.invite_code

            if not is_creator and not has_valid_code:
                # Verifier si invitation PENDING ou ACCEPTED
                invitation = await db.execute(
                    select(FocusRoomInvitation).where(
                        and_(
                            FocusRoomInvitation.room_id == room.id,
                            FocusRoomInvitation.invitee_id == user.id,
                            FocusRoomInvitation.status.in_([
                                InvitationStatus.PENDING,
                                InvitationStatus.ACCEPTED
                            ])
                        )
                    )
                )
                inv = invitation.scalar_one_or_none()
                if not inv:
                    raise ValueError("access_denied")
                # Marquer comme acceptée si c'était pending
                if inv.status == InvitationStatus.PENDING:
                    inv.accept()

        # Récupérer les minutes du jour dans cette room (sessions précédentes)
        today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_sessions_query = await db.execute(
            select(func.coalesce(func.sum(FocusSession.focus_minutes), 0))
            .where(
                and_(
                    FocusSession.user_id == user.id,
                    FocusSession.room_id == room.id,
                    FocusSession.started_at >= today_start
                )
            )
        )
        today_minutes_from_sessions = today_sessions_query.scalar() or 0
        logger.info(f"[JOIN_ROOM] User {user.id} rejoining room {room.id}, today_minutes_from_sessions: {today_minutes_from_sessions}")

        # Creer le participant avec les minutes du jour déjà accumulées
        participant = FocusRoomParticipant(
            room_id=room.id,
            user_id=user.id,
            status=ParticipantStatus.FOCUSING,
            current_activity=activity,
            current_subject_id=subject_id,
            is_visible=is_visible,
            focus_started_at=utc_now(),
            today_focus_minutes=today_minutes_from_sessions  # Conserver les minutes du jour
        )

        db.add(participant)

        # Mettre a jour stats room
        room.total_unique_users += 1
        room.today_sessions += 1

        await db.commit()
        await db.refresh(participant)

        # Mettre a jour stats utilisateur
        await self._update_user_focus_stats(db, user.id, rooms_joined=1)

        # Attribuer XP
        await award_xp(
            user=user,
            amount=XP_REWARDS["join_room"],
            reason="focus_room_joined",
            extra_data={"room_id": room.id}
        )

        # Creer activite
        await self._create_activity(
            db, room.id, user.id,
            FocusActivityType.USER_JOINED,
            f"{user.username} vient de rejoindre la room"
        )

        logger.info(f"User {user.id} joined room {room.id}")
        return participant

    async def leave_room(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant
    ) -> FocusSession:
        """Quitter une room et sauvegarder la session"""
        now = utc_now()
        room = participant.room
        user_id = participant.user_id

        # Sauvegarder le temps en cours
        participant._save_current_time()

        # Creer la session historique
        session = FocusSession(
            room_id=room.id,
            user_id=user_id,
            subject_id=participant.current_subject_id,
            started_at=participant.joined_at,
            ended_at=now,
            focus_minutes=participant.current_focus_minutes,
            break_minutes=participant.current_break_minutes,
            total_minutes=participant.current_focus_minutes + participant.current_break_minutes,
            milestones_reached=participant.milestones_reached or [],
            room_name=room.name
        )
        session.focus_score = session.calculate_focus_score()

        # Calculer XP
        base_xp, bonus_xp = session.calculate_xp()
        session.xp_earned = base_xp
        session.xp_bonus = bonus_xp

        db.add(session)

        # Mettre a jour stats room
        room.total_focus_minutes += session.focus_minutes
        room.total_sessions += 1
        room.today_focus_minutes += session.focus_minutes

        # Supprimer le participant
        await db.delete(participant)

        await db.commit()
        await db.refresh(session)

        # Mettre a jour stats utilisateur
        await self._update_user_focus_stats(
            db, user_id,
            minutes=session.focus_minutes,
            sessions=1,
            xp_earned=session.xp_earned,
            xp_bonus=session.xp_bonus,
            focus_score=session.focus_score
        )

        # Récupérer l'utilisateur pour award_xp et l'activité
        user = await db.get(User, user_id)

        # Attribuer XP
        total_xp = session.xp_earned + session.xp_bonus
        if total_xp > 0 and user:
            await award_xp(
                user=user,
                amount=total_xp,
                reason="focus_session_completed",
                extra_data={"session_id": session.id, "minutes": session.focus_minutes}
            )

        # Creer activite
        await self._create_activity(
            db, room.id, user_id,
            FocusActivityType.USER_LEFT,
            f"{user.username} a quitte apres {session.focus_minutes} min de focus",
            {"minutes": session.focus_minutes}
        )

        logger.info(f"User {user_id} left room {room.id}, {session.focus_minutes} min")
        return session

    async def update_status(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant,
        new_status: ParticipantStatus
    ) -> FocusRoomParticipant:
        """Met a jour le statut d'un participant"""
        old_status = participant.status

        if new_status == ParticipantStatus.FOCUSING:
            if old_status == ParticipantStatus.BREAK:
                participant.resume_focus()
            else:
                participant.start_focus()
        elif new_status == ParticipantStatus.BREAK:
            participant.start_break()
        elif new_status == ParticipantStatus.AWAY:
            participant.set_away()
        elif new_status == ParticipantStatus.IDLE:
            participant.set_idle()
        elif new_status == ParticipantStatus.DEEP_WORK:
            # Le deep work doit être démarré via start_deep_work()
            participant.start_deep_work()

        participant.last_activity_at = utc_now()
        await db.commit()
        await db.refresh(participant)

        return participant

    # ==================== DEEP WORK ====================

    async def start_deep_work(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant,
        duration_minutes: int = 90
    ) -> FocusRoomParticipant:
        """Démarre une session Deep Work (90 min par défaut, notifications bloquées)"""
        # Vérifier que le participant n'est pas déjà en deep work
        if participant.status == ParticipantStatus.DEEP_WORK:
            raise ValueError("already_in_deep_work")

        user_id = participant.user_id

        # Démarrer le deep work
        participant.start_deep_work(duration_minutes)
        await db.commit()

        # Recharger avec toutes les relations nécessaires
        updated_participant = await self.get_participant(db, user_id)

        # Créer activité
        await self._create_activity(
            db, updated_participant.room_id, user_id,
            FocusActivityType.DEEP_WORK_STARTED,
            f"{updated_participant.user.username} commence une session Deep Work de {duration_minutes} min 🧠",
            {"duration_minutes": duration_minutes}
        )

        logger.info(f"User {user_id} started deep work for {duration_minutes} min")
        return updated_participant

    async def end_deep_work(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant,
        user: User
    ) -> Tuple[FocusRoomParticipant, bool]:
        """Termine une session Deep Work (retourne si complétée avec succès)"""
        if participant.status != ParticipantStatus.DEEP_WORK:
            raise ValueError("not_in_deep_work")

        # Vérifier si la session est complète (temps écoulé >= durée prévue)
        now = utc_now()
        completed = participant.deep_work_end_at and now >= participant.deep_work_end_at
        user_id = participant.user_id
        room_id = participant.room_id

        # Terminer le deep work
        participant.end_deep_work(completed=completed)
        await db.commit()

        # Recharger avec toutes les relations nécessaires
        updated_participant = await self.get_participant(db, user_id)

        # Créer activité et donner XP si complété
        if completed:
            await self._create_activity(
                db, room_id, user_id,
                FocusActivityType.DEEP_WORK_COMPLETED,
                f"{updated_participant.user.username} a terminé sa session Deep Work ! 🎉",
                {"completed": True, "sessions_total": updated_participant.deep_work_sessions_completed}
            )

            # Attribuer XP bonus
            await award_xp(
                user=user,
                amount=XP_REWARDS["deep_work_completed"],
                reason="deep_work_completed",
                extra_data={"room_id": room_id}
            )
        else:
            await self._create_activity(
                db, room_id, user_id,
                FocusActivityType.DEEP_WORK_COMPLETED,
                f"{updated_participant.user.username} a interrompu sa session Deep Work",
                {"completed": False}
            )

        logger.info(f"User {user_id} ended deep work, completed={completed}")
        return updated_participant, completed

    async def get_deep_work_status(
        self,
        participant: FocusRoomParticipant
    ) -> dict:
        """Retourne le statut Deep Work d'un participant"""
        if not participant.is_in_deep_work():
            return {
                "in_deep_work": False,
                "remaining_minutes": 0,
                "sessions_completed": participant.deep_work_sessions_completed
            }

        return {
            "in_deep_work": True,
            "started_at": participant.deep_work_started_at.isoformat() if participant.deep_work_started_at else None,
            "ends_at": participant.deep_work_end_at.isoformat() if participant.deep_work_end_at else None,
            "remaining_minutes": participant.get_deep_work_remaining_minutes(),
            "sessions_completed": participant.deep_work_sessions_completed
        }

    async def check_deep_work_completion(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant
    ) -> bool:
        """Vérifie si une session Deep Work est terminée (appelé périodiquement)"""
        if not participant.is_in_deep_work():
            return False

        now = utc_now()
        if participant.deep_work_end_at and now >= participant.deep_work_end_at:
            # Session terminée automatiquement
            user = await db.get(User, participant.user_id)
            await self.end_deep_work(db, participant, user)
            return True

        return False

    async def update_activity(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant,
        activity: Optional[str],
        subject_id: Optional[int]
    ) -> FocusRoomParticipant:
        """Met a jour l'activite d'un participant"""
        participant.current_activity = activity
        participant.current_subject_id = subject_id
        participant.last_activity_at = utc_now()

        await db.commit()
        await db.refresh(participant)
        return participant

    async def heartbeat(
        self,
        db: AsyncSession,
        participant: FocusRoomParticipant
    ) -> Optional[str]:
        """Heartbeat du participant, retourne milestone si atteint"""
        now = utc_now()
        participant.last_heartbeat_at = now
        participant.last_activity_at = now

        # Sauvegarder les minutes de focus en cours dans la DB
        # Cela permet de ne pas perdre le temps si l'utilisateur ferme le navigateur
        if participant.focus_started_at and participant.status in [ParticipantStatus.FOCUSING, ParticipantStatus.DEEP_WORK]:
            elapsed = (now - participant.focus_started_at).total_seconds() / 60
            if elapsed >= 1:  # Sauvegarder au moins 1 minute
                # Ajouter le temps écoulé aux minutes cumulées
                participant.current_focus_minutes += int(elapsed)
                participant.today_focus_minutes += int(elapsed)
                # Reset le point de départ pour éviter le double comptage
                participant.focus_started_at = now

        # Verifier milestone
        milestone = participant.check_milestone()

        await db.commit()
        return milestone

    async def check_idle_participants(
        self,
        db: AsyncSession,
        room_id: int,
        idle_threshold_minutes: int = 10
    ) -> List[int]:
        """Verifie et marque les participants inactifs"""
        threshold = utc_now() - timedelta(minutes=idle_threshold_minutes)

        query = select(FocusRoomParticipant).where(
            and_(
                FocusRoomParticipant.room_id == room_id,
                FocusRoomParticipant.last_heartbeat_at < threshold,
                FocusRoomParticipant.status.in_([
                    ParticipantStatus.FOCUSING,
                    ParticipantStatus.BREAK
                ])
            )
        )

        result = await db.execute(query)
        participants = result.scalars().all()

        idle_user_ids = []
        for p in participants:
            p.set_idle()
            idle_user_ids.append(p.user_id)

        if idle_user_ids:
            await db.commit()

        return idle_user_ids

    async def cleanup_stale_participants(
        self,
        db: AsyncSession,
        stale_threshold_hours: int = 1
    ) -> int:
        """
        Nettoie les participants abandonnés (pas de heartbeat depuis X heures)
        Sauvegarde leur session et met à jour leurs stats
        ATTENTION: Ne sauvegarde que le temps déjà enregistré dans current_focus_minutes
        pour éviter de compter le temps où l'utilisateur n'était pas vraiment actif
        """
        threshold = utc_now() - timedelta(hours=stale_threshold_hours)

        # Trouver tous les participants avec un heartbeat ancien
        query = select(FocusRoomParticipant).where(
            FocusRoomParticipant.last_heartbeat_at < threshold
        ).options(
            selectinload(FocusRoomParticipant.room),
            selectinload(FocusRoomParticipant.user)
        )

        result = await db.execute(query)
        stale_participants = result.scalars().all()

        cleaned_count = 0
        for participant in stale_participants:
            try:
                # NE PAS appeler _save_current_time() car cela compterait
                # tout le temps depuis focus_started_at qui peut être très ancien
                # On utilise uniquement le temps déjà sauvegardé via heartbeat

                # Créer une session si le participant a du temps de focus déjà enregistré
                if participant.current_focus_minutes > 0:
                    session = FocusSession(
                        room_id=participant.room_id,
                        user_id=participant.user_id,
                        subject_id=participant.current_subject_id,
                        started_at=participant.joined_at,
                        ended_at=participant.last_heartbeat_at,  # Utiliser le dernier heartbeat
                        focus_minutes=participant.current_focus_minutes,
                        break_minutes=participant.current_break_minutes,
                        total_minutes=participant.current_focus_minutes + participant.current_break_minutes,
                        milestones_reached=participant.milestones_reached or [],
                        room_name=participant.room.name if participant.room else "Unknown"
                    )
                    session.focus_score = session.calculate_focus_score()
                    base_xp, bonus_xp = session.calculate_xp()
                    session.xp_earned = base_xp
                    session.xp_bonus = bonus_xp

                    db.add(session)

                    # Mettre à jour les stats utilisateur
                    await self._update_user_focus_stats(
                        db, participant.user_id,
                        minutes=session.focus_minutes,
                        sessions=1,
                        xp_earned=session.xp_earned,
                        xp_bonus=session.xp_bonus,
                        focus_score=session.focus_score
                    )

                    logger.info(f"Cleaned stale participant {participant.user_id}, saved {session.focus_minutes} min")

                # Supprimer le participant
                await db.delete(participant)
                cleaned_count += 1

            except Exception as e:
                logger.error(f"Error cleaning stale participant {participant.user_id}: {e}")
                continue

        if cleaned_count > 0:
            await db.commit()

        return cleaned_count

    async def get_participant(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Optional[FocusRoomParticipant]:
        """Recupere le participant actif d'un user"""
        result = await db.execute(
            select(FocusRoomParticipant)
            .where(FocusRoomParticipant.user_id == user_id)
            .options(
                selectinload(FocusRoomParticipant.room),
                selectinload(FocusRoomParticipant.user).selectinload(User.profile),
                selectinload(FocusRoomParticipant.user).selectinload(User.gamification),
                selectinload(FocusRoomParticipant.current_subject)
            )
        )
        return result.scalar_one_or_none()

    async def get_room_participants(
        self,
        db: AsyncSession,
        room_id: int,
        active_only: bool = False
    ) -> List[FocusRoomParticipant]:
        """Recupere les participants d'une room"""
        query = select(FocusRoomParticipant).where(
            FocusRoomParticipant.room_id == room_id
        ).options(
            selectinload(FocusRoomParticipant.user),
            selectinload(FocusRoomParticipant.current_subject)
        )

        if active_only:
            query = query.where(
                FocusRoomParticipant.status.in_([
                    ParticipantStatus.FOCUSING,
                    ParticipantStatus.BREAK
                ])
            )

        result = await db.execute(query)
        return list(result.scalars().all())

    # ==================== INVITATIONS ====================

    async def invite_user(
        self,
        db: AsyncSession,
        room: FocusRoom,
        inviter: User,
        invitee_id: int,
        message: Optional[str] = None
    ) -> FocusRoomInvitation:
        """Invite un utilisateur dans une room privee"""
        if not room.is_private:
            raise ValueError("room_not_private")

        # Verifier si deja invite
        existing = await db.execute(
            select(FocusRoomInvitation).where(
                and_(
                    FocusRoomInvitation.room_id == room.id,
                    FocusRoomInvitation.invitee_id == invitee_id,
                    FocusRoomInvitation.status == InvitationStatus.PENDING
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("already_invited")

        invitation = FocusRoomInvitation(
            room_id=room.id,
            inviter_id=inviter.id,
            invitee_id=invitee_id,
            message=message,
            expires_at=utc_now() + timedelta(days=7)
        )

        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        # Envoyer notification à l'invité
        await notification_service.notify_focus_room_invite(
            db=db,
            invitee_id=invitee_id,
            inviter_username=inviter.username,
            room_name=room.name,
            room_id=room.id,
            invitation_id=invitation.id,
            message=message
        )
        await db.commit()

        logger.info(f"User {inviter.id} invited user {invitee_id} to room {room.id}")
        return invitation

    async def get_pending_invitations(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[FocusRoomInvitation]:
        """Recupere les invitations en attente"""
        result = await db.execute(
            select(FocusRoomInvitation)
            .where(
                and_(
                    FocusRoomInvitation.invitee_id == user_id,
                    FocusRoomInvitation.status == InvitationStatus.PENDING,
                    FocusRoomInvitation.expires_at > utc_now()
                )
            )
            .options(
                selectinload(FocusRoomInvitation.room),
                selectinload(FocusRoomInvitation.inviter)
            )
        )
        return list(result.scalars().all())

    async def respond_to_invitation(
        self,
        db: AsyncSession,
        invitation: FocusRoomInvitation,
        accept: bool,
        invitee_username: Optional[str] = None
    ) -> FocusRoomInvitation:
        """Repond a une invitation"""
        if invitation.is_expired():
            invitation.status = InvitationStatus.EXPIRED
            await db.commit()
            raise ValueError("invitation_expired")

        if accept:
            invitation.accept()
            # XP pour l'inviteur
            inviter = await db.get(User, invitation.inviter_id)
            if inviter:
                await award_xp(
                    user=inviter,
                    amount=XP_REWARDS["invitation_accepted"],
                    reason="focus_invitation_accepted",
                    extra_data={"invitee_id": invitation.invitee_id}
                )

            # Charger la room pour la notification
            room = await db.get(FocusRoom, invitation.room_id)
            if room and invitee_username:
                # Notifier l'inviteur que l'invitation a été acceptée
                await notification_service.notify_focus_room_invite_accepted(
                    db=db,
                    inviter_id=invitation.inviter_id,
                    invitee_username=invitee_username,
                    room_name=room.name,
                    room_id=room.id
                )
        else:
            invitation.decline()

        await db.commit()
        await db.refresh(invitation)
        return invitation

    # ==================== POKES ====================

    async def send_poke(
        self,
        db: AsyncSession,
        room_id: int,
        from_user_id: int,
        to_user_id: int,
        message: Optional[str] = None
    ) -> FocusRoomPoke:
        """Envoie un poke a un autre participant"""
        # Rate limit: 10 pokes par minute
        minute_ago = utc_now() - timedelta(minutes=1)
        recent = await db.execute(
            select(func.count()).where(
                and_(
                    FocusRoomPoke.from_user_id == from_user_id,
                    FocusRoomPoke.created_at > minute_ago
                )
            )
        )
        if recent.scalar() >= 10:
            raise ValueError("rate_limited")

        poke = FocusRoomPoke(
            room_id=room_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            message=message
        )

        db.add(poke)
        await db.commit()
        await db.refresh(poke)

        return poke

    # ==================== ACTIVITIES ====================

    async def _create_activity(
        self,
        db: AsyncSession,
        room_id: int,
        user_id: int,
        activity_type: FocusActivityType,
        message: Optional[str] = None,
        extra_data: Optional[Dict] = None
    ) -> FocusRoomActivity:
        """Cree une activite dans le feed"""
        activity = FocusRoomActivity(
            room_id=room_id,
            user_id=user_id,
            activity_type=activity_type,
            message=message,
            extra_data=extra_data
        )

        db.add(activity)
        await db.commit()
        await db.refresh(activity)

        # Cache Redis pour acces rapide
        cache_key = f"focus_room:{room_id}:activities"
        activity_data = {
            "id": activity.id,
            "type": activity_type.value,
            "user_id": user_id,
            "message": message,
            "extra_data": extra_data,
            "created_at": activity.created_at.isoformat()
        }
        await cache_service.lpush(cache_key, json.dumps(activity_data))
        await cache_service.ltrim(cache_key, 0, 49)  # Garder 50 dernieres

        return activity

    async def get_room_activities(
        self,
        db: AsyncSession,
        room_id: int,
        limit: int = 50
    ) -> List[FocusRoomActivity]:
        """Recupere les activites recentes d'une room"""
        result = await db.execute(
            select(FocusRoomActivity)
            .where(FocusRoomActivity.room_id == room_id)
            .options(selectinload(FocusRoomActivity.user))
            .order_by(desc(FocusRoomActivity.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    # ==================== STATS ====================

    async def get_room_stats(
        self,
        db: AsyncSession,
        room: FocusRoom
    ) -> RoomStatsResponse:
        """Recupere les stats d'une room"""
        # Reset stats journalieres si necessaire
        room.reset_daily_stats_if_needed()

        # Compter participants actifs
        active_count = len([
            p for p in room.participants
            if p.status in [ParticipantStatus.FOCUSING, ParticipantStatus.BREAK, ParticipantStatus.DEEP_WORK]
        ])

        # Top focuser du jour
        top_focuser = None
        if room.participants:
            top = max(room.participants, key=lambda p: p.today_focus_minutes, default=None)
            if top and top.today_focus_minutes > 0:
                top_focuser = {
                    "user_id": top.user_id,
                    "username": top.user.username if top.user else "Unknown",
                    "minutes": top.today_focus_minutes
                }

        return RoomStatsResponse(
            active_participants=active_count,
            today_focus_minutes=room.today_focus_minutes,
            today_sessions=room.today_sessions,
            total_focus_minutes=room.total_focus_minutes,
            total_sessions=room.total_sessions,
            total_unique_users=room.total_unique_users,
            peak_participants=room.peak_participants,
            top_focuser=top_focuser
        )

    async def get_room_leaderboard(
        self,
        db: AsyncSession,
        room_id: int,
        period: str = "today",
        limit: int = 10
    ) -> List[LeaderboardEntry]:
        """Recupere le leaderboard d'une room"""
        # Calculer les dates selon la periode
        now = utc_now()
        if period == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # all_time
            start_date = datetime.min

        # Agreger par utilisateur
        query = select(
            FocusSession.user_id,
            func.sum(FocusSession.focus_minutes).label("total_minutes"),
            func.count(FocusSession.id).label("sessions_count")
        ).where(
            and_(
                FocusSession.room_id == room_id,
                FocusSession.started_at >= start_date
            )
        ).group_by(FocusSession.user_id).order_by(
            desc("total_minutes")
        ).limit(limit)

        result = await db.execute(query)
        rows = result.fetchall()

        entries = []
        for rank, row in enumerate(rows, 1):
            user = await db.get(User, row.user_id)
            if user:
                entries.append(LeaderboardEntry(
                    rank=rank,
                    user_id=row.user_id,
                    username=user.username,
                    avatar_url=user.avatar_url,
                    level=user.level,
                    focus_minutes=row.total_minutes or 0,
                    sessions_count=row.sessions_count or 0
                ))

        return entries

    async def get_user_focus_stats(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Optional[UserFocusRoomStats]:
        """Recupere les stats Focus Room d'un utilisateur"""
        result = await db.execute(
            select(UserFocusRoomStats)
            .where(UserFocusRoomStats.user_id == user_id)
            .options(selectinload(UserFocusRoomStats.favorite_room))
        )
        return result.scalar_one_or_none()

    async def _update_user_focus_stats(
        self,
        db: AsyncSession,
        user_id: int,
        minutes: int = 0,
        sessions: int = 0,
        rooms_joined: int = 0,
        rooms_created: int = 0,
        xp_earned: int = 0,
        xp_bonus: int = 0,
        focus_score: int = 0
    ):
        """Met a jour les stats Focus Room d'un utilisateur"""
        stats = await self.get_user_focus_stats(db, user_id)

        if not stats:
            stats = UserFocusRoomStats(
                user_id=user_id,
                total_focus_room_minutes=0,
                total_focus_room_sessions=0,
                total_rooms_joined=0,
                total_rooms_created=0,
                total_xp_earned=0,
                total_xp_bonus=0
            )
            db.add(stats)

        # Utiliser les valeurs actuelles ou 0 si None
        stats.total_rooms_joined = (stats.total_rooms_joined or 0) + rooms_joined
        stats.total_rooms_created = (stats.total_rooms_created or 0) + rooms_created

        if minutes > 0:
            # record_session met à jour minutes, sessions, xp, streak, etc.
            stats.record_session(minutes, focus_score, xp_earned, xp_bonus)
        else:
            # Si pas de minutes, ajouter juste les XP (milestones, rewards)
            stats.total_xp_earned = (stats.total_xp_earned or 0) + xp_earned
            stats.total_xp_bonus = (stats.total_xp_bonus or 0) + xp_bonus

        await db.commit()


    # ==================== EVENT/TEMPORARY ROOMS ====================

    async def create_event_room(
        self,
        db: AsyncSession,
        user: User,
        room_data: FocusRoomCreate
    ) -> FocusRoom:
        """Crée une room événement/temporaire avec dates de début et fin"""
        # Forcer le type EVENT
        room_data.room_type = FocusRoomType.EVENT

        if not room_data.starts_at or not room_data.ends_at:
            raise ValueError("event_dates_required")

        if room_data.ends_at <= room_data.starts_at:
            raise ValueError("invalid_dates")

        room = await self.create_room(db, user, room_data)
        logger.info(f"Event room created: {room.name} ({room.starts_at} - {room.ends_at})")
        return room

    async def list_upcoming_events(
        self,
        db: AsyncSession,
        limit: int = 10,
        user_id: Optional[int] = None
    ) -> List[FocusRoom]:
        """Liste les événements à venir"""
        now = utc_now()

        query = select(FocusRoom).where(
            and_(
                FocusRoom.is_active == True,
                FocusRoom.room_type == FocusRoomType.EVENT,
                FocusRoom.starts_at > now
            )
        ).order_by(asc(FocusRoom.starts_at)).limit(limit)

        # Exclure les événements privés sauf si invité
        if user_id:
            invited_rooms_subquery = select(FocusRoomInvitation.room_id).where(
                and_(
                    FocusRoomInvitation.invitee_id == user_id,
                    FocusRoomInvitation.status.in_([InvitationStatus.PENDING, InvitationStatus.ACCEPTED])
                )
            )
            query = query.where(
                or_(
                    FocusRoom.is_private == False,
                    FocusRoom.creator_id == user_id,
                    FocusRoom.id.in_(invited_rooms_subquery)
                )
            )
        else:
            query = query.where(FocusRoom.is_private == False)

        query = query.options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.creator),
            selectinload(FocusRoom.subject)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def list_active_events(
        self,
        db: AsyncSession,
        limit: int = 10,
        user_id: Optional[int] = None
    ) -> List[FocusRoom]:
        """Liste les événements en cours"""
        now = utc_now()

        query = select(FocusRoom).where(
            and_(
                FocusRoom.is_active == True,
                FocusRoom.room_type == FocusRoomType.EVENT,
                FocusRoom.starts_at <= now,
                FocusRoom.ends_at >= now
            )
        ).order_by(desc(FocusRoom.ends_at)).limit(limit)

        # Exclure les événements privés sauf si invité
        if user_id:
            invited_rooms_subquery = select(FocusRoomInvitation.room_id).where(
                and_(
                    FocusRoomInvitation.invitee_id == user_id,
                    FocusRoomInvitation.status.in_([InvitationStatus.PENDING, InvitationStatus.ACCEPTED])
                )
            )
            query = query.where(
                or_(
                    FocusRoom.is_private == False,
                    FocusRoom.creator_id == user_id,
                    FocusRoom.id.in_(invited_rooms_subquery)
                )
            )
        else:
            query = query.where(FocusRoom.is_private == False)

        query = query.options(
            selectinload(FocusRoom.participants),
            selectinload(FocusRoom.creator),
            selectinload(FocusRoom.subject)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def cleanup_expired_events(
        self,
        db: AsyncSession
    ) -> int:
        """Désactive les événements expirés (tâche périodique)"""
        now = utc_now()

        # Trouver les événements expirés
        expired_query = select(FocusRoom).where(
            and_(
                FocusRoom.is_active == True,
                FocusRoom.room_type == FocusRoomType.EVENT,
                FocusRoom.ends_at < now
            )
        )

        result = await db.execute(expired_query)
        expired_rooms = result.scalars().all()

        count = 0
        for room in expired_rooms:
            # Faire quitter tous les participants
            participants = await self.get_room_participants(db, room.id)
            for p in participants:
                try:
                    await self.leave_room(db, p)
                except Exception as e:
                    logger.error(f"Error removing participant from expired event: {e}")

            # Désactiver la room
            room.is_active = False
            count += 1

        if count > 0:
            await db.commit()
            logger.info(f"Cleaned up {count} expired event rooms")

        return count

    async def get_event_countdown(
        self,
        room: FocusRoom
    ) -> dict:
        """Retourne le compte à rebours pour un événement"""
        now = utc_now()

        if room.room_type != FocusRoomType.EVENT:
            return {"status": "not_event"}

        if not room.starts_at or not room.ends_at:
            return {"status": "no_dates"}

        if now < room.starts_at:
            # Événement à venir
            delta = room.starts_at - now
            return {
                "status": "upcoming",
                "starts_in_seconds": int(delta.total_seconds()),
                "starts_in_minutes": int(delta.total_seconds() / 60),
                "starts_at": room.starts_at.isoformat()
            }
        elif now <= room.ends_at:
            # Événement en cours
            delta = room.ends_at - now
            return {
                "status": "active",
                "ends_in_seconds": int(delta.total_seconds()),
                "ends_in_minutes": int(delta.total_seconds() / 60),
                "ends_at": room.ends_at.isoformat()
            }
        else:
            # Événement terminé
            return {
                "status": "ended",
                "ended_at": room.ends_at.isoformat()
            }


# Instance singleton
focus_room_service = FocusRoomService()
