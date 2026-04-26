# -*- coding: utf-8 -*-
"""Add additional offline.indicator.* and antiCheat.* keys."""
import json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

NEW = {
    "offline": {
        "indicator.pendingActions": {
            "fr": "{count} action(s) en attente",
            "en": "{count} pending action(s)",
            "es": "{count} acción(es) pendientes",
            "ar": "{count} إجراءات معلقة",
        },
        "indicator.pendingShort": {
            "fr": "{count} en attente",
            "en": "{count} pending",
            "es": "{count} pendientes",
            "ar": "{count} معلق",
        },
        "indicator.syncButton": {
            "fr": "Sync",
            "en": "Sync",
            "es": "Sincronizar",
            "ar": "مزامنة",
        },
        "indicator.connectionRestored": {
            "fr": "Connexion rétablie",
            "en": "Connection restored",
            "es": "Conexión restaurada",
            "ar": "تمت استعادة الاتصال",
        },
        "indicator.connectionRestoredSync": {
            "fr": "Synchronisation de {count} action(s)...",
            "en": "Syncing {count} action(s)...",
            "es": "Sincronizando {count} acción(es)...",
            "ar": "جارٍ مزامنة {count} إجراءات...",
        },
        "indicator.offlineMode": {
            "fr": "Mode hors ligne - Vos modifications seront synchronisées automatiquement",
            "en": "Offline mode - Your changes will sync automatically",
            "es": "Modo sin conexión - Tus cambios se sincronizarán automáticamente",
            "ar": "وضع عدم الاتصال - ستتم مزامنة تغييراتك تلقائيًا",
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
