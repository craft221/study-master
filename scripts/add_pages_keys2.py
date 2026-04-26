# -*- coding: utf-8 -*-
"""Supplementary keys for /duels and other pages (round 2)."""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

NEW_KEYS = {
    "common.close": {"fr": "Fermer", "en": "Close", "es": "Cerrar", "ar": "إغلاق"},
    "common.linkCopiedToClipboard": {
        "fr": "Le lien a été copié dans le presse-papiers",
        "en": "The link has been copied to clipboard",
        "es": "El enlace se copió al portapapeles",
        "ar": "تم نسخ الرابط إلى الحافظة",
    },
    "duels.createChallengeError": {
        "fr": "Impossible de créer le défi",
        "en": "Unable to create challenge",
        "es": "No se puede crear el desafío",
        "ar": "تعذر إنشاء التحدي",
    },
    "duels.declineError": {
        "fr": "Impossible de refuser le défi",
        "en": "Unable to decline challenge",
        "es": "No se puede rechazar el desafío",
        "ar": "تعذر رفض التحدي",
    },
    "duels.cancelError": {
        "fr": "Impossible d'annuler le défi",
        "en": "Unable to cancel challenge",
        "es": "No se puede cancelar el desafío",
        "ar": "تعذر إلغاء التحدي",
    },
    "duels.createLinkError": {
        "fr": "Impossible de créer le lien",
        "en": "Unable to create link",
        "es": "No se puede crear el enlace",
        "ar": "تعذر إنشاء الرابط",
    },
    "duels.selectQuizForDuel": {
        "fr": "Sélectionnez un quiz pour le duel",
        "en": "Select a quiz for the duel",
        "es": "Selecciona un cuestionario para el duelo",
        "ar": "اختر اختبارًا للمبارزة",
    },
    "duels.launchAChallenge": {
        "fr": "Lancez un défi !",
        "en": "Launch a challenge!",
        "es": "¡Lanza un desafío!",
        "ar": "ابدأ تحديًا!",
    },
    "duels.opponentShort": {"fr": "Adv", "en": "Opp", "es": "Op", "ar": "م"},
    "duels.messageCopied": {
        "fr": "Message copié !",
        "en": "Message copied!",
        "es": "¡Mensaje copiado!",
        "ar": "تم نسخ الرسالة!",
    },
    "duels.readyToShare": {
        "fr": "Prêt à partager",
        "en": "Ready to share",
        "es": "Listo para compartir",
        "ar": "جاهز للمشاركة",
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
        added = 0
        for dotted_path, translations in NEW_KEYS.items():
            if has_path(data, dotted_path):
                continue
            set_path(data, dotted_path, translations[lang])
            added += 1
        with io.open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'{lang}.json: +{added} keys')


if __name__ == '__main__':
    main()
