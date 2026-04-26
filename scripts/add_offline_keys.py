# -*- coding: utf-8 -*-
"""Add additional offline.* keys covering the offline page strings."""
import json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

NEW = {
    "offline": {
        "page.checkConnection": {
            "fr": "Vérifier la connexion",
            "en": "Check connection",
            "es": "Verificar conexión",
            "ar": "التحقق من الاتصال",
        },
        "page.checking": {
            "fr": "Vérification...",
            "en": "Checking...",
            "es": "Verificando...",
            "ar": "جارٍ التحقق...",
        },
        "page.heroDescription": {
            "fr": "Pas de connexion Internet détectée. Certaines fonctionnalités restent disponibles grâce à vos données en cache.",
            "en": "No internet connection detected. Some features remain available thanks to your cached data.",
            "es": "No se detectó conexión a internet. Algunas funciones siguen disponibles gracias a tus datos en caché.",
            "ar": "لم يتم اكتشاف اتصال بالإنترنت. تبقى بعض الميزات متاحة بفضل بياناتك المخزنة.",
        },
        "page.featuresTitle": {
            "fr": "Fonctionnalités disponibles hors ligne",
            "en": "Features available offline",
            "es": "Funciones disponibles sin conexión",
            "ar": "الميزات المتاحة دون اتصال",
        },
        "page.featureNotesTitle": {"fr": "Notes", "en": "Notes", "es": "Notas", "ar": "ملاحظات"},
        "page.featureNotesDesc": {
            "fr": "Consultez vos notes téléchargées",
            "en": "View your downloaded notes",
            "es": "Consulta tus notas descargadas",
            "ar": "اطلع على ملاحظاتك المحفوظة",
        },
        "page.featureFlashcardsTitle": {"fr": "Flashcards", "en": "Flashcards", "es": "Flashcards", "ar": "بطاقات تعليمية"},
        "page.featureFlashcardsDesc": {
            "fr": "Révisez vos flashcards en cache",
            "en": "Review your cached flashcards",
            "es": "Revisa tus flashcards en caché",
            "ar": "راجع بطاقاتك المخزنة",
        },
        "page.featureCalendarTitle": {"fr": "Calendrier", "en": "Calendar", "es": "Calendario", "ar": "التقويم"},
        "page.featureCalendarDesc": {
            "fr": "Consultez votre emploi du temps",
            "en": "View your schedule",
            "es": "Consulta tu horario",
            "ar": "اطلع على جدولك",
        },
        "page.featureStudyTitle": {"fr": "Étude", "en": "Study", "es": "Estudio", "ar": "الدراسة"},
        "page.featureStudyDesc": {
            "fr": "Continuez vos sessions d'étude",
            "en": "Continue your study sessions",
            "es": "Continúa tus sesiones de estudio",
            "ar": "تابع جلسات دراستك",
        },
        "page.modeTitle": {
            "fr": "Mode hors ligne activé",
            "en": "Offline mode enabled",
            "es": "Modo sin conexión activado",
            "ar": "تم تفعيل وضع عدم الاتصال",
        },
        "page.tip1": {
            "fr": "Vos modifications seront synchronisées automatiquement",
            "en": "Your changes will be synced automatically",
            "es": "Tus cambios se sincronizarán automáticamente",
            "ar": "ستتم مزامنة تغييراتك تلقائيًا",
        },
        "page.tip2": {
            "fr": "Les données en cache sont utilisées pour l'affichage",
            "en": "Cached data is used for display",
            "es": "Los datos en caché se usan para la visualización",
            "ar": "تُستخدم البيانات المخزنة للعرض",
        },
        "page.tip3": {
            "fr": "Certaines fonctionnalités comme les quiz en direct sont indisponibles",
            "en": "Some features like live quizzes are unavailable",
            "es": "Algunas funciones como los cuestionarios en vivo no están disponibles",
            "ar": "بعض الميزات مثل الاختبارات المباشرة غير متاحة",
        },
        "page.pwaNote": {
            "fr": "Studera fonctionne même sans connexion grâce à la technologie PWA.",
            "en": "Studera works even without a connection thanks to PWA technology.",
            "es": "Studera funciona incluso sin conexión gracias a la tecnología PWA.",
            "ar": "يعمل Studera حتى بدون اتصال بفضل تقنية PWA.",
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


def has_path(node, dotted_path):
    keys = dotted_path.split('.')
    cur = node
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return False
        cur = cur[k]
    return True


def main():
    for lang in ['fr', 'en', 'es', 'ar']:
        path = os.path.join(MSG_DIR, f'{lang}.json')
        with io.open(path, encoding='utf-8') as f:
            data = json.load(f)
        for section, items in NEW.items():
            if section not in data:
                data[section] = {}
            for sub_path, translations in items.items():
                if has_path(data[section], sub_path):
                    continue
                set_path(data[section], sub_path, translations[lang])
        with io.open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'{lang}.json updated')


if __name__ == '__main__':
    main()
