# -*- coding: utf-8 -*-
"""Add additional cookies.* keys for the cookie consent banner."""
import json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

NEW = {
    "cookies": {
        "manageTitle": {
            "fr": "Gestion des cookies",
            "en": "Cookie management",
            "es": "Gestión de cookies",
            "ar": "إدارة ملفات تعريف الارتباط",
        },
        "managePreamble": {
            "fr": "Nous utilisons des cookies pour améliorer votre expérience et analyser l'utilisation de notre plateforme. Vous pouvez choisir d'accepter tous les cookies ou uniquement les cookies essentiels.",
            "en": "We use cookies to improve your experience and analyze use of our platform. You can choose to accept all cookies or only essential cookies.",
            "es": "Usamos cookies para mejorar tu experiencia y analizar el uso de nuestra plataforma. Puedes elegir aceptar todas las cookies o solo las esenciales.",
            "ar": "نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتحليل استخدام منصتنا. يمكنك اختيار قبول كل ملفات تعريف الارتباط أو فقط الأساسية منها.",
        },
        "essentialActive": {
            "fr": "Toujours actifs",
            "en": "Always on",
            "es": "Siempre activas",
            "ar": "دائمًا نشطة",
        },
        "essentialFull": {
            "fr": "Nécessaires au fonctionnement du site : authentification, sécurité, préférences de session.",
            "en": "Required for the site to function: authentication, security, session preferences.",
            "es": "Necesarias para el funcionamiento del sitio: autenticación, seguridad, preferencias de sesión.",
            "ar": "ضرورية لعمل الموقع: المصادقة والأمان وتفضيلات الجلسة.",
        },
        "analyticsOptional": {
            "fr": "Optionnels",
            "en": "Optional",
            "es": "Opcionales",
            "ar": "اختيارية",
        },
        "analyticsFull": {
            "fr": "Google Analytics : nous aident à comprendre comment vous utilisez le site pour l'améliorer. Les données sont anonymisées.",
            "en": "Google Analytics: helps us understand how you use the site to improve it. Data is anonymized.",
            "es": "Google Analytics: nos ayudan a entender cómo usas el sitio para mejorarlo. Los datos son anonimizados.",
            "ar": "Google Analytics: تساعدنا في فهم كيفية استخدامك للموقع لتحسينه. البيانات مجهولة الهوية.",
        },
        "essentialOnly": {
            "fr": "Essentiels uniquement",
            "en": "Essential only",
            "es": "Solo esenciales",
            "ar": "الأساسية فقط",
        },
        "details": {
            "fr": "Détails",
            "en": "Details",
            "es": "Detalles",
            "ar": "التفاصيل",
        },
        "hide": {
            "fr": "Masquer",
            "en": "Hide",
            "es": "Ocultar",
            "ar": "إخفاء",
        },
        "privacyLinkPrefix": {
            "fr": "En savoir plus sur notre",
            "en": "Learn more about our",
            "es": "Saber más sobre nuestra",
            "ar": "اعرف المزيد عن",
        },
        "privacyLinkLabel": {
            "fr": "Politique de confidentialité",
            "en": "Privacy Policy",
            "es": "Política de privacidad",
            "ar": "سياسة الخصوصية",
        },
        "close": {
            "fr": "Fermer",
            "en": "Close",
            "es": "Cerrar",
            "ar": "إغلاق",
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
