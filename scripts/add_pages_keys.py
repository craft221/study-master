# -*- coding: utf-8 -*-
"""
Add comprehensive i18n keys for /duels, /explore, /leaderboard, /achievements,
/quests, /groups, /admin, /profile, /settings pages in 4 languages (fr/en/es/ar).
Idempotent: only adds keys that don't yet exist.
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

# Structure: dotted path -> {fr, en, es, ar}
NEW_KEYS = {
    # ============== COMMON additions ==============
    "common.error": {"fr": "Erreur", "en": "Error", "es": "Error", "ar": "خطأ"},
    "common.warning": {"fr": "Attention", "en": "Warning", "es": "Atención", "ar": "تنبيه"},
    "common.success": {"fr": "Succès", "en": "Success", "es": "Éxito", "ar": "نجاح"},
    "common.copied": {"fr": "Copié !", "en": "Copied!", "es": "¡Copiado!", "ar": "تم النسخ!"},
    "common.copiedToClipboard": {
        "fr": "Copié dans le presse-papiers",
        "en": "Copied to clipboard",
        "es": "Copiado al portapapeles",
        "ar": "تم النسخ إلى الحافظة",
    },
    "common.linkCopied": {"fr": "Lien copié !", "en": "Link copied!", "es": "¡Enlace copiado!", "ar": "تم نسخ الرابط!"},
    "common.all": {"fr": "Tous", "en": "All", "es": "Todos", "ar": "الكل"},
    "common.allFem": {"fr": "Toutes", "en": "All", "es": "Todas", "ar": "الكل"},
    "common.play": {"fr": "Jouer", "en": "Play", "es": "Jugar", "ar": "العب"},
    "common.played": {"fr": "Joué", "en": "Played", "es": "Jugado", "ar": "تم اللعب"},
    "common.view": {"fr": "Voir", "en": "View", "es": "Ver", "ar": "عرض"},
    "common.or": {"fr": "ou", "en": "or", "es": "o", "ar": "أو"},
    "common.ok": {"fr": "OK", "en": "OK", "es": "OK", "ar": "حسنًا"},
    "common.cancel": {"fr": "Annuler", "en": "Cancel", "es": "Cancelar", "ar": "إلغاء"},
    "common.accept": {"fr": "Accepter", "en": "Accept", "es": "Aceptar", "ar": "قبول"},
    "common.decline": {"fr": "Refuser", "en": "Decline", "es": "Rechazar", "ar": "رفض"},
    "common.pending": {"fr": "En attente", "en": "Pending", "es": "Pendiente", "ar": "قيد الانتظار"},
    "common.accepted": {"fr": "Accepté", "en": "Accepted", "es": "Aceptado", "ar": "مقبول"},
    "common.inProgress": {"fr": "En cours", "en": "In progress", "es": "En curso", "ar": "قيد التنفيذ"},
    "common.completed": {"fr": "Terminé", "en": "Completed", "es": "Completado", "ar": "مكتمل"},
    "common.cancelled": {"fr": "Annulé", "en": "Cancelled", "es": "Cancelado", "ar": "ملغى"},
    "common.declined": {"fr": "Refusé", "en": "Declined", "es": "Rechazado", "ar": "مرفوض"},
    "common.waiting": {"fr": "Attente", "en": "Waiting", "es": "Esperando", "ar": "في الانتظار"},
    "common.you": {"fr": "Vous", "en": "You", "es": "Tú", "ar": "أنت"},
    "common.anonymous": {"fr": "Anonyme", "en": "Anonymous", "es": "Anónimo", "ar": "مجهول"},
    "common.victory": {"fr": "Victoire", "en": "Victory", "es": "Victoria", "ar": "انتصار"},
    "common.draw": {"fr": "Égalité", "en": "Draw", "es": "Empate", "ar": "تعادل"},
    "common.loadMore": {"fr": "Charger plus", "en": "Load more", "es": "Cargar más", "ar": "تحميل المزيد"},
    "common.level": {"fr": "Niv.", "en": "Lv.", "es": "Niv.", "ar": "المستوى"},
    "common.minutes": {"fr": "{count} min", "en": "{count} min", "es": "{count} min", "ar": "{count} دقيقة"},
    "common.hours": {"fr": "{count}h", "en": "{count}h", "es": "{count}h", "ar": "{count} ساعة"},
    "common.hoursMinutes": {
        "fr": "{hours}h {minutes}min",
        "en": "{hours}h {minutes}min",
        "es": "{hours}h {minutes}min",
        "ar": "{hours} ساعة {minutes} دقيقة",
    },
    "common.confirm": {"fr": "Confirmer", "en": "Confirm", "es": "Confirmar", "ar": "تأكيد"},
    "common.yes": {"fr": "Oui", "en": "Yes", "es": "Sí", "ar": "نعم"},
    "common.no": {"fr": "Non", "en": "No", "es": "No", "ar": "لا"},
    "common.difficulty.easy": {"fr": "Facile", "en": "Easy", "es": "Fácil", "ar": "سهل"},
    "common.difficulty.medium": {"fr": "Moyen", "en": "Medium", "es": "Medio", "ar": "متوسط"},
    "common.difficulty.hard": {"fr": "Difficile", "en": "Hard", "es": "Difícil", "ar": "صعب"},

    # ============== DUELS ==============
    "duels.title": {"fr": "Duels", "en": "Duels", "es": "Duelos", "ar": "المبارزات"},
    "duels.subtitle": {
        "fr": "Défiez vos amis et gagnez de l'XP !",
        "en": "Challenge your friends and earn XP!",
        "es": "¡Desafía a tus amigos y gana XP!",
        "ar": "تحدَّ أصدقاءك واكسب نقاط الخبرة!",
    },
    "duels.loadError": {
        "fr": "Impossible de charger les duels",
        "en": "Unable to load duels",
        "es": "No se pueden cargar los duelos",
        "ar": "تعذر تحميل المبارزات",
    },
    "duels.invalidDuelId": {
        "fr": "ID de duel invalide",
        "en": "Invalid duel ID",
        "es": "ID de duelo inválido",
        "ar": "معرّف المبارزة غير صالح",
    },
    "duels.acceptError": {
        "fr": "Impossible d'accepter le défi",
        "en": "Unable to accept challenge",
        "es": "No se puede aceptar el desafío",
        "ar": "تعذر قبول التحدي",
    },
    "duels.selectOpponentAndQuiz": {
        "fr": "Sélectionnez un adversaire et un quiz",
        "en": "Select an opponent and a quiz",
        "es": "Selecciona un oponente y un cuestionario",
        "ar": "اختر منافسًا واختبارًا",
    },
    "duels.challengeSent": {
        "fr": "Défi envoyé ! ⚔️",
        "en": "Challenge sent! ⚔️",
        "es": "¡Desafío enviado! ⚔️",
        "ar": "تم إرسال التحدي! ⚔️",
    },
    "duels.challengeReceivedNotif": {
        "fr": "Votre adversaire a reçu votre défi",
        "en": "Your opponent received your challenge",
        "es": "Tu oponente recibió tu desafío",
        "ar": "استلم منافسك تحديك",
    },
    "duels.challengeAccepted": {
        "fr": "Défi accepté ! 🎯",
        "en": "Challenge accepted! 🎯",
        "es": "¡Desafío aceptado! 🎯",
        "ar": "تم قبول التحدي! 🎯",
    },
    "duels.bestManWins": {
        "fr": "Que le meilleur gagne !",
        "en": "May the best one win!",
        "es": "¡Que gane el mejor!",
        "ar": "ليفز الأفضل!",
    },
    "duels.confirmDeclineChallenge": {
        "fr": "Êtes-vous sûr de vouloir refuser ce défi ?",
        "en": "Are you sure you want to decline this challenge?",
        "es": "¿Estás seguro de que quieres rechazar este desafío?",
        "ar": "هل أنت متأكد من رفض هذا التحدي؟",
    },
    "duels.challengeDeclined": {
        "fr": "Défi refusé",
        "en": "Challenge declined",
        "es": "Desafío rechazado",
        "ar": "تم رفض التحدي",
    },
    "duels.challengeDeclinedDesc": {
        "fr": "Le défi a été décliné",
        "en": "The challenge has been declined",
        "es": "El desafío ha sido rechazado",
        "ar": "تم رفض التحدي",
    },
    "duels.confirmCancelChallenge": {
        "fr": "Êtes-vous sûr de vouloir annuler ce défi ?",
        "en": "Are you sure you want to cancel this challenge?",
        "es": "¿Estás seguro de que quieres cancelar este desafío?",
        "ar": "هل أنت متأكد من إلغاء هذا التحدي؟",
    },
    "duels.challengeCancelled": {
        "fr": "Défi annulé",
        "en": "Challenge cancelled",
        "es": "Desafío cancelado",
        "ar": "تم إلغاء التحدي",
    },
    "duels.challengeCancelledDesc": {
        "fr": "Le défi a été annulé",
        "en": "The challenge has been cancelled",
        "es": "El desafío ha sido cancelado",
        "ar": "تم إلغاء التحدي",
    },
    "duels.inviteLinkCreated": {
        "fr": "Lien créé ! 🔗",
        "en": "Link created! 🔗",
        "es": "¡Enlace creado! 🔗",
        "ar": "تم إنشاء الرابط! 🔗",
    },
    "duels.shareWithOpponent": {
        "fr": "Partagez-le avec votre adversaire",
        "en": "Share it with your opponent",
        "es": "Compártelo con tu oponente",
        "ar": "شاركه مع منافسك",
    },
    "duels.matchQuality.excellent": {
        "fr": "Match parfait",
        "en": "Perfect match",
        "es": "Partido perfecto",
        "ar": "تطابق مثالي",
    },
    "duels.matchQuality.good": {
        "fr": "Bon match",
        "en": "Good match",
        "es": "Buen partido",
        "ar": "تطابق جيد",
    },
    "duels.matchQuality.fair": {
        "fr": "Match équilibré",
        "en": "Balanced match",
        "es": "Partido equilibrado",
        "ar": "تطابق متوازن",
    },
    "duels.launchChallenge": {
        "fr": "Lancer un défi",
        "en": "Launch a challenge",
        "es": "Lanzar un desafío",
        "ar": "ابدأ تحديًا",
    },
    "duels.challenge": {"fr": "Défier", "en": "Challenge", "es": "Desafiar", "ar": "تحدَّ"},
    "duels.createDuel": {"fr": "Créer un duel", "en": "Create a duel", "es": "Crear un duelo", "ar": "إنشاء مبارزة"},
    "duels.createDuelDesc": {
        "fr": "Choisissez un adversaire et un quiz pour le défi",
        "en": "Choose an opponent and a quiz for the challenge",
        "es": "Elige un oponente y un cuestionario para el desafío",
        "ar": "اختر منافسًا واختبارًا للتحدي",
    },
    "duels.opponent": {"fr": "Adversaire", "en": "Opponent", "es": "Oponente", "ar": "المنافس"},
    "duels.selectOpponent": {
        "fr": "Sélectionner un adversaire",
        "en": "Select an opponent",
        "es": "Selecciona un oponente",
        "ar": "اختر منافسًا",
    },
    "duels.quiz": {"fr": "Quiz", "en": "Quiz", "es": "Cuestionario", "ar": "اختبار"},
    "duels.selectQuiz": {
        "fr": "Sélectionner un quiz",
        "en": "Select a quiz",
        "es": "Selecciona un cuestionario",
        "ar": "اختر اختبارًا",
    },
    "duels.stakeXP": {"fr": "Enjeux XP", "en": "XP stakes", "es": "Apuesta XP", "ar": "نقاط الخبرة المراهنة"},
    "duels.stakesExplanation": {
        "fr": "Le gagnant remporte {stakes} XP, le perdant en perd {loss}",
        "en": "Winner gets {stakes} XP, loser loses {loss}",
        "es": "El ganador obtiene {stakes} XP, el perdedor pierde {loss}",
        "ar": "الفائز يربح {stakes} نقطة خبرة، الخاسر يفقد {loss}",
    },
    "duels.sendChallenge": {
        "fr": "Envoyer le défi",
        "en": "Send challenge",
        "es": "Enviar desafío",
        "ar": "أرسل التحدي",
    },
    "duels.createInviteLink": {
        "fr": "Créer un lien d'invitation",
        "en": "Create invite link",
        "es": "Crear enlace de invitación",
        "ar": "إنشاء رابط دعوة",
    },
    "duels.shareInviteLinkDesc": {
        "fr": "Partagez le lien pour défier n'importe qui",
        "en": "Share the link to challenge anyone",
        "es": "Comparte el enlace para desafiar a cualquiera",
        "ar": "شارك الرابط لتحدي أي شخص",
    },
    "duels.inviteLinkCreatedTitle": {
        "fr": "Lien d'invitation créé !",
        "en": "Invite link created!",
        "es": "¡Enlace de invitación creado!",
        "ar": "تم إنشاء رابط الدعوة!",
    },
    "duels.inviteLinkExpiresIn24h": {
        "fr": "Partagez ce lien avec la personne que vous voulez défier. Il expire dans 24 heures.",
        "en": "Share this link with the person you want to challenge. It expires in 24 hours.",
        "es": "Comparte este enlace con la persona que quieres desafiar. Caduca en 24 horas.",
        "ar": "شارك هذا الرابط مع الشخص الذي تريد تحديه. ينتهي خلال 24 ساعة.",
    },
    "duels.shareMessage": {
        "fr": "Je te défie en duel !\n\nClique ici pour accepter: {link}",
        "en": "I challenge you to a duel!\n\nClick here to accept: {link}",
        "es": "¡Te desafío a un duelo!\n\nHaz clic aquí para aceptar: {link}",
        "ar": "أتحداك في مبارزة!\n\nانقر هنا للقبول: {link}",
    },
    "duels.copyMessage": {"fr": "Copier le message", "en": "Copy message", "es": "Copiar mensaje", "ar": "نسخ الرسالة"},
    "duels.recommendedOpponents": {
        "fr": "Adversaires recommandés",
        "en": "Recommended opponents",
        "es": "Oponentes recomendados",
        "ar": "المنافسون المقترحون",
    },
    "duels.playersWithSimilarLevel": {
        "fr": "Joueurs avec un niveau similaire",
        "en": "Players with a similar level",
        "es": "Jugadores con un nivel similar",
        "ar": "لاعبون بمستوى مماثل",
    },
    "duels.active": {"fr": "Actifs", "en": "Active", "es": "Activos", "ar": "نشطة"},
    "duels.requests": {"fr": "Demandes", "en": "Requests", "es": "Solicitudes", "ar": "طلبات"},
    "duels.wins": {"fr": "Victoires", "en": "Wins", "es": "Victorias", "ar": "انتصارات"},
    "duels.netXP": {"fr": "XP Net", "en": "Net XP", "es": "XP Neto", "ar": "صافي نقاط الخبرة"},
    "duels.sent": {"fr": "Envoyés", "en": "Sent", "es": "Enviados", "ar": "مرسلة"},
    "duels.history": {"fr": "Historique", "en": "History", "es": "Historial", "ar": "السجل"},
    "duels.noChallengeRequests": {
        "fr": "Aucune demande de duel",
        "en": "No duel requests",
        "es": "Sin solicitudes de duelo",
        "ar": "لا توجد طلبات مبارزة",
    },
    "duels.userChallengesYou": {
        "fr": "{username} vous défie !",
        "en": "{username} is challenging you!",
        "es": "¡{username} te desafía!",
        "ar": "{username} يتحداك!",
    },
    "duels.noPendingChallenge": {
        "fr": "Aucun défi en attente",
        "en": "No pending challenge",
        "es": "Sin desafíos pendientes",
        "ar": "لا توجد تحديات معلقة",
    },
    "duels.challengeTo": {
        "fr": "Défi à {username}",
        "en": "Challenge to {username}",
        "es": "Desafío a {username}",
        "ar": "تحدٍ إلى {username}",
    },
    "duels.noActiveDuel": {
        "fr": "Aucun duel actif",
        "en": "No active duel",
        "es": "Sin duelos activos",
        "ar": "لا توجد مبارزات نشطة",
    },
    "duels.opponentHasNotPlayed": {
        "fr": "{username} n'a pas joué",
        "en": "{username} hasn't played",
        "es": "{username} no ha jugado",
        "ar": "{username} لم يلعب بعد",
    },
    "duels.waitingForOpponent": {
        "fr": "Attente adversaire...",
        "en": "Waiting for opponent...",
        "es": "Esperando al oponente...",
        "ar": "في انتظار المنافس...",
    },
    "duels.noCompletedDuel": {
        "fr": "Aucun duel terminé",
        "en": "No completed duel",
        "es": "Sin duelos completados",
        "ar": "لا توجد مبارزات منتهية",
    },

    # ============== EXPLORE ==============
    "explore.title": {"fr": "Explorer", "en": "Explore", "es": "Explorar", "ar": "استكشف"},
    "explore.subtitle": {
        "fr": "Découvre du contenu créé par la communauté Studera",
        "en": "Discover content created by the Studera community",
        "es": "Descubre contenido creado por la comunidad Studera",
        "ar": "اكتشف محتوى أنشأه مجتمع ستوديرا",
    },
    "explore.searchPlaceholder": {
        "fr": "Rechercher des notes, flashcards, quiz...",
        "en": "Search notes, flashcards, quizzes...",
        "es": "Buscar notas, flashcards, cuestionarios...",
        "ar": "ابحث في الملاحظات والبطاقات والاختبارات...",
    },
    "explore.allSubjects": {
        "fr": "Toutes les matières",
        "en": "All subjects",
        "es": "Todas las materias",
        "ar": "كل المواد",
    },
    "explore.clearFilters": {
        "fr": "Effacer les filtres",
        "en": "Clear filters",
        "es": "Borrar filtros",
        "ar": "مسح الفلاتر",
    },
    "explore.notes": {"fr": "Notes", "en": "Notes", "es": "Notas", "ar": "الملاحظات"},
    "explore.flashcards": {"fr": "Flashcards", "en": "Flashcards", "es": "Flashcards", "ar": "البطاقات"},
    "explore.quiz": {"fr": "Quiz", "en": "Quiz", "es": "Cuestionarios", "ar": "الاختبارات"},
    "explore.flashcardDecks": {
        "fr": "Decks de Flashcards",
        "en": "Flashcard Decks",
        "es": "Mazos de Flashcards",
        "ar": "حزم البطاقات",
    },
    "explore.duplicate": {"fr": "Dupliquer", "en": "Duplicate", "es": "Duplicar", "ar": "نسخ"},
    "explore.duplicated": {"fr": "Dupliqué !", "en": "Duplicated!", "es": "¡Duplicado!", "ar": "تم النسخ!"},
    "explore.duplicateError": {
        "fr": "Impossible de dupliquer",
        "en": "Unable to duplicate",
        "es": "No se puede duplicar",
        "ar": "تعذر النسخ",
    },
    "explore.loadContentError": {
        "fr": "Impossible de charger le contenu",
        "en": "Unable to load content",
        "es": "No se puede cargar el contenido",
        "ar": "تعذر تحميل المحتوى",
    },
    "explore.quizLinkCopiedToClipboard": {
        "fr": "Le lien du quiz a été copié dans le presse-papier",
        "en": "The quiz link has been copied to the clipboard",
        "es": "El enlace del cuestionario se copió al portapapeles",
        "ar": "تم نسخ رابط الاختبار إلى الحافظة",
    },
    "explore.reportSent": {
        "fr": "Signalement envoyé",
        "en": "Report sent",
        "es": "Reporte enviado",
        "ar": "تم إرسال البلاغ",
    },
    "explore.teamWillReview": {
        "fr": "Notre équipe va examiner ce contenu",
        "en": "Our team will review this content",
        "es": "Nuestro equipo revisará este contenido",
        "ar": "سيراجع فريقنا هذا المحتوى",
    },
    "explore.reportError": {
        "fr": "Impossible de signaler",
        "en": "Unable to report",
        "es": "No se puede reportar",
        "ar": "تعذر الإبلاغ",
    },
    "explore.sortBy.recent": {
        "fr": "Plus récents",
        "en": "Most recent",
        "es": "Más recientes",
        "ar": "الأحدث",
    },
    "explore.sortBy.popular": {
        "fr": "Populaires",
        "en": "Popular",
        "es": "Populares",
        "ar": "الأكثر شعبية",
    },
    "explore.sortBy.bestRating": {
        "fr": "Meilleurs scores",
        "en": "Best rated",
        "es": "Mejor valorados",
        "ar": "الأعلى تقييمًا",
    },
    "explore.resultsFound": {
        "fr": "{count} résultat(s) trouvé(s)",
        "en": "{count} result(s) found",
        "es": "{count} resultado(s) encontrado(s)",
        "ar": "تم العثور على {count} نتيجة",
    },
    "explore.cardCount": {
        "fr": "{count} carte(s)",
        "en": "{count} card(s)",
        "es": "{count} carta(s)",
        "ar": "{count} بطاقة",
    },
    "explore.questionCount": {
        "fr": "{count} question(s)",
        "en": "{count} question(s)",
        "es": "{count} pregunta(s)",
        "ar": "{count} سؤالًا",
    },
    "explore.playCount": {
        "fr": "{count} partie(s)",
        "en": "{count} play(s)",
        "es": "{count} partida(s)",
        "ar": "{count} لعبة",
    },
    "explore.ai": {"fr": "IA", "en": "AI", "es": "IA", "ar": "ذكاء اصطناعي"},
    "explore.noContentFound": {
        "fr": "Aucun contenu trouvé",
        "en": "No content found",
        "es": "No se encontró contenido",
        "ar": "لم يتم العثور على محتوى",
    },
    "explore.adjustFiltersOrSearch": {
        "fr": "Essaie d'ajuster tes filtres ou ta recherche",
        "en": "Try adjusting your filters or search",
        "es": "Intenta ajustar tus filtros o búsqueda",
        "ar": "جرب تعديل الفلاتر أو البحث",
    },

    # ============== LEADERBOARD / ADMIN / GROUPS / PROFILE / SETTINGS ==============
    "leaderboard.loadError": {
        "fr": "Impossible de charger les données de ligue",
        "en": "Unable to load league data",
        "es": "No se pueden cargar los datos de liga",
        "ar": "تعذر تحميل بيانات الدوري",
    },
    "groups.loadError": {
        "fr": "Impossible de charger les groupes",
        "en": "Unable to load groups",
        "es": "No se pueden cargar los grupos",
        "ar": "تعذر تحميل المجموعات",
    },
    "groups.loadGroupError": {
        "fr": "Impossible de charger le groupe",
        "en": "Unable to load group",
        "es": "No se puede cargar el grupo",
        "ar": "تعذر تحميل المجموعة",
    },
    "groups.noUserFound": {
        "fr": "Aucun utilisateur trouvé",
        "en": "No user found",
        "es": "Ningún usuario encontrado",
        "ar": "لم يتم العثور على مستخدم",
    },
    "profile.loadError": {
        "fr": "Impossible de charger le profil",
        "en": "Unable to load profile",
        "es": "No se puede cargar el perfil",
        "ar": "تعذر تحميل الملف الشخصي",
    },
    "settings.loadError": {
        "fr": "Impossible de charger le profil",
        "en": "Unable to load profile",
        "es": "No se puede cargar el perfil",
        "ar": "تعذر تحميل الملف الشخصي",
    },
    "admin.noData": {"fr": "Aucune donnée", "en": "No data", "es": "Sin datos", "ar": "لا توجد بيانات"},
    "admin.noEmailFound": {
        "fr": "Aucun email trouvé",
        "en": "No email found",
        "es": "Ningún correo encontrado",
        "ar": "لم يتم العثور على بريد إلكتروني",
    },
    "examMode.noDocument": {
        "fr": "Aucun document",
        "en": "No document",
        "es": "Sin documento",
        "ar": "لا توجد وثيقة",
    },
    "flashcards.noCardToReview": {
        "fr": "Aucune carte à réviser",
        "en": "No card to review",
        "es": "Sin cartas para revisar",
        "ar": "لا توجد بطاقات للمراجعة",
    },
    "export.loadError": {
        "fr": "Impossible de charger les données",
        "en": "Unable to load data",
        "es": "No se pueden cargar los datos",
        "ar": "تعذر تحميل البيانات",
    },
}


def set_path(node, dotted_path, value):
    keys = dotted_path.split('.')
    cur = node
    for k in keys[:-1]:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]
    cur[keys[-1]] = value


def has_path(node, dotted_path):
    keys = dotted_path.split('.')
    cur = node
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return False
        cur = cur[k]
    return True


def main():
    added_per_lang = {l: 0 for l in ['fr', 'en', 'es', 'ar']}
    for lang in ['fr', 'en', 'es', 'ar']:
        path = os.path.join(MSG_DIR, f'{lang}.json')
        with io.open(path, encoding='utf-8') as f:
            data = json.load(f)
        for dotted_path, translations in NEW_KEYS.items():
            if has_path(data, dotted_path):
                continue
            set_path(data, dotted_path, translations[lang])
            added_per_lang[lang] += 1
        with io.open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'{lang}.json updated: {added_per_lang[lang]} new keys')


if __name__ == '__main__':
    main()
