# -*- coding: utf-8 -*-
"""
Add new i18n keys (Phase 1.3 externalization) to all four locale files.

The keys are defined for fr/en/es/ar in NEW_KEYS below. The script merges
them into each locale's JSON, preserving existing structure.
"""
import json
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')


# Schema: section -> { key_path_relative_to_section -> { fr, en, es, ar } }
# Keys may be nested with dots, e.g. "indicator.online".
NEW_KEYS = {
    "offline": {
        "page.title": {
            "fr": "Vous êtes hors ligne",
            "en": "You are offline",
            "es": "Estás sin conexión",
            "ar": "أنت غير متصل بالإنترنت",
        },
        "page.description": {
            "fr": "Il semble que vous n'ayez pas de connexion internet pour le moment.",
            "en": "It looks like you don't have an internet connection right now.",
            "es": "Parece que no tienes conexión a internet en este momento.",
            "ar": "يبدو أنك غير متصل بالإنترنت حاليًا.",
        },
        "page.retry": {
            "fr": "Réessayer",
            "en": "Retry",
            "es": "Reintentar",
            "ar": "إعادة المحاولة",
        },
        "page.tipsTitle": {
            "fr": "En attendant, vous pouvez :",
            "en": "While you wait, you can:",
            "es": "Mientras tanto, puedes:",
            "ar": "في هذه الأثناء، يمكنك:",
        },
        "page.tipNotes": {
            "fr": "Consulter vos notes mises en cache",
            "en": "View your cached notes",
            "es": "Ver tus notas en caché",
            "ar": "الاطلاع على ملاحظاتك المخزنة",
        },
        "page.tipFlashcards": {
            "fr": "Réviser vos flashcards téléchargées",
            "en": "Review your downloaded flashcards",
            "es": "Revisar tus flashcards descargadas",
            "ar": "مراجعة بطاقاتك التعليمية المحفوظة",
        },
        "page.tipSync": {
            "fr": "Vos modifications seront synchronisées automatiquement",
            "en": "Your changes will be synced automatically",
            "es": "Tus cambios se sincronizarán automáticamente",
            "ar": "ستتم مزامنة تغييراتك تلقائيًا",
        },
        "indicator.online": {
            "fr": "En ligne",
            "en": "Online",
            "es": "En línea",
            "ar": "متصل",
        },
        "indicator.offline": {
            "fr": "Hors ligne",
            "en": "Offline",
            "es": "Sin conexión",
            "ar": "غير متصل",
        },
        "indicator.syncing": {
            "fr": "Synchronisation...",
            "en": "Syncing...",
            "es": "Sincronizando...",
            "ar": "جارٍ المزامنة...",
        },
        "indicator.synced": {
            "fr": "Synchronisé",
            "en": "Synced",
            "es": "Sincronizado",
            "ar": "تمت المزامنة",
        },
        "indicator.pendingChanges": {
            "fr": "{count} modifications en attente",
            "en": "{count} pending changes",
            "es": "{count} cambios pendientes",
            "ar": "{count} تغييرات معلقة",
        },
    },
    "cookies": {
        "title": {
            "fr": "Nous utilisons des cookies",
            "en": "We use cookies",
            "es": "Usamos cookies",
            "ar": "نحن نستخدم ملفات تعريف الارتباط",
        },
        "description": {
            "fr": "Nous utilisons des cookies pour améliorer votre expérience. Vous pouvez gérer vos préférences à tout moment.",
            "en": "We use cookies to improve your experience. You can manage your preferences at any time.",
            "es": "Usamos cookies para mejorar tu experiencia. Puedes gestionar tus preferencias en cualquier momento.",
            "ar": "نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك إدارة تفضيلاتك في أي وقت.",
        },
        "accept": {
            "fr": "Tout accepter",
            "en": "Accept all",
            "es": "Aceptar todo",
            "ar": "قبول الكل",
        },
        "reject": {
            "fr": "Tout refuser",
            "en": "Reject all",
            "es": "Rechazar todo",
            "ar": "رفض الكل",
        },
        "customize": {
            "fr": "Personnaliser",
            "en": "Customize",
            "es": "Personalizar",
            "ar": "تخصيص",
        },
        "save": {
            "fr": "Enregistrer mes préférences",
            "en": "Save my preferences",
            "es": "Guardar mis preferencias",
            "ar": "حفظ تفضيلاتي",
        },
        "essential": {
            "fr": "Essentiels",
            "en": "Essential",
            "es": "Esenciales",
            "ar": "أساسية",
        },
        "essentialDesc": {
            "fr": "Nécessaires au fonctionnement du site (toujours actifs)",
            "en": "Necessary for the site to function (always on)",
            "es": "Necesarias para el funcionamiento del sitio (siempre activas)",
            "ar": "ضرورية لعمل الموقع (دائمًا نشطة)",
        },
        "analytics": {
            "fr": "Analytiques",
            "en": "Analytics",
            "es": "Analíticas",
            "ar": "تحليلية",
        },
        "analyticsDesc": {
            "fr": "Nous aident à comprendre comment vous utilisez le site",
            "en": "Help us understand how you use the site",
            "es": "Nos ayudan a entender cómo usas el sitio",
            "ar": "تساعدنا في فهم كيفية استخدامك للموقع",
        },
        "marketing": {
            "fr": "Marketing",
            "en": "Marketing",
            "es": "Marketing",
            "ar": "تسويقية",
        },
        "marketingDesc": {
            "fr": "Utilisés pour personnaliser les contenus et publicités",
            "en": "Used to personalize content and ads",
            "es": "Usadas para personalizar contenidos y anuncios",
            "ar": "تُستخدم لتخصيص المحتوى والإعلانات",
        },
        "learnMore": {
            "fr": "En savoir plus",
            "en": "Learn more",
            "es": "Saber más",
            "ar": "اعرف المزيد",
        },
    },
    "metadata": {
        "title": {
            "fr": "Studera - Votre assistant d'apprentissage intelligent",
            "en": "Studera - Your intelligent learning assistant",
            "es": "Studera - Tu asistente de aprendizaje inteligente",
            "ar": "Studera - مساعدك الذكي للتعلم",
        },
        "description": {
            "fr": "Application d'apprentissage avec IA, flashcards, quiz et gamification",
            "en": "Learning app with AI, flashcards, quizzes and gamification",
            "es": "Aplicación de aprendizaje con IA, flashcards, cuestionarios y gamificación",
            "ar": "تطبيق تعلم يجمع بين الذكاء الاصطناعي والبطاقات التعليمية والاختبارات والتلعيب",
        },
    },
    "editor": {
        "errors.imageUpload": {
            "fr": "Erreur lors de l'upload de l'image",
            "en": "Error uploading image",
            "es": "Error al subir la imagen",
            "ar": "خطأ أثناء رفع الصورة",
        },
        "errors.imageSize": {
            "fr": "L'image est trop volumineuse",
            "en": "Image is too large",
            "es": "La imagen es demasiado grande",
            "ar": "حجم الصورة كبير جدًا",
        },
        "errors.imageType": {
            "fr": "Type d'image non supporté",
            "en": "Unsupported image type",
            "es": "Tipo de imagen no admitido",
            "ar": "نوع الصورة غير مدعوم",
        },
        "errors.unknown": {
            "fr": "Une erreur inconnue est survenue",
            "en": "An unknown error occurred",
            "es": "Ocurrió un error desconocido",
            "ar": "حدث خطأ غير متوقع",
        },
    },
    "search": {
        "empty": {
            "fr": "Aucun résultat",
            "en": "No results",
            "es": "Sin resultados",
            "ar": "لا توجد نتائج",
        },
    },
    "groups": {
        "flashcards.empty": {
            "fr": "Aucune flashcard dans ce groupe",
            "en": "No flashcards in this group",
            "es": "No hay flashcards en este grupo",
            "ar": "لا توجد بطاقات تعليمية في هذه المجموعة",
        },
        "flashcards.create": {
            "fr": "Créer des flashcards",
            "en": "Create flashcards",
            "es": "Crear flashcards",
            "ar": "إنشاء بطاقات",
        },
        "activity.empty": {
            "fr": "Aucune activité dans ce groupe",
            "en": "No activity in this group",
            "es": "Sin actividad en este grupo",
            "ar": "لا يوجد نشاط في هذه المجموعة",
        },
        "activity.recent": {
            "fr": "Activité récente",
            "en": "Recent activity",
            "es": "Actividad reciente",
            "ar": "النشاط الأخير",
        },
    },
    "focusRoom": {
        "events.empty": {
            "fr": "Aucun événement à venir",
            "en": "No upcoming events",
            "es": "No hay eventos próximos",
            "ar": "لا توجد فعاليات قادمة",
        },
        "events.duration15": {"fr": "15 minutes", "en": "15 minutes", "es": "15 minutos", "ar": "15 دقيقة"},
        "events.duration30": {"fr": "30 minutes", "en": "30 minutes", "es": "30 minutos", "ar": "30 دقيقة"},
        "events.duration60": {"fr": "60 minutes", "en": "60 minutes", "es": "60 minutos", "ar": "60 دقيقة"},
        "events.duration90": {"fr": "90 minutes", "en": "90 minutes", "es": "90 minutos", "ar": "90 دقيقة"},
        "events.duration120": {"fr": "120 minutes", "en": "120 minutes", "es": "120 minutos", "ar": "120 دقيقة"},
        "events.categoryStudy": {"fr": "Étude", "en": "Study", "es": "Estudio", "ar": "دراسة"},
        "events.categoryWork": {"fr": "Travail", "en": "Work", "es": "Trabajo", "ar": "عمل"},
        "events.categoryReading": {"fr": "Lecture", "en": "Reading", "es": "Lectura", "ar": "قراءة"},
        "deepWork.started": {
            "fr": "Mode Travail Profond démarré",
            "en": "Deep work mode started",
            "es": "Modo Trabajo Profundo iniciado",
            "ar": "بدأ وضع العمل العميق",
        },
        "deepWork.ended": {
            "fr": "Mode Travail Profond terminé",
            "en": "Deep work mode ended",
            "es": "Modo Trabajo Profundo terminado",
            "ar": "انتهى وضع العمل العميق",
        },
        "deepWork.paused": {
            "fr": "Session en pause",
            "en": "Session paused",
            "es": "Sesión en pausa",
            "ar": "تم إيقاف الجلسة مؤقتًا",
        },
        "deepWork.resumed": {
            "fr": "Session reprise",
            "en": "Session resumed",
            "es": "Sesión reanudada",
            "ar": "تم استئناف الجلسة",
        },
        "deepWork.error": {
            "fr": "Impossible de démarrer la session",
            "en": "Unable to start session",
            "es": "No se pudo iniciar la sesión",
            "ar": "تعذر بدء الجلسة",
        },
    },
    "antiCheat": {
        "warning": {
            "fr": "Activité suspecte détectée",
            "en": "Suspicious activity detected",
            "es": "Actividad sospechosa detectada",
            "ar": "تم اكتشاف نشاط مشبوه",
        },
        "tabSwitch": {
            "fr": "Changement d'onglet détecté",
            "en": "Tab switch detected",
            "es": "Cambio de pestaña detectado",
            "ar": "تم اكتشاف تغيير علامة التبويب",
        },
        "fullscreenExit": {
            "fr": "Sortie du mode plein écran détectée",
            "en": "Fullscreen exit detected",
            "es": "Salida del modo pantalla completa detectada",
            "ar": "تم الخروج من وضع ملء الشاشة",
        },
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


def merge_keys(target_node, lang):
    for section, items in NEW_KEYS.items():
        if section not in target_node:
            target_node[section] = {}
        for sub_path, translations in items.items():
            # Only set if not already present (idempotent)
            keys = sub_path.split('.')
            cur = target_node[section]
            present = True
            for k in keys[:-1]:
                if not isinstance(cur, dict) or k not in cur:
                    present = False
                    break
                cur = cur[k]
            if present and isinstance(cur, dict) and keys[-1] in cur:
                continue
            set_path(target_node[section], sub_path, translations[lang])


def main():
    for lang in ['fr', 'en', 'es', 'ar']:
        path = os.path.join(MSG_DIR, f'{lang}.json')
        with io.open(path, encoding='utf-8') as f:
            data = json.load(f)
        merge_keys(data, lang)
        with io.open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'{lang}.json updated.')


if __name__ == '__main__':
    main()
