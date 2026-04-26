# -*- coding: utf-8 -*-
"""Add antiCheat.* keys."""
import json, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')

NEW = {
    "antiCheat": {
        "statusInactive": {"fr": "Inactif", "en": "Inactive", "es": "Inactivo", "ar": "غير نشط"},
        "statusAlert": {"fr": "Alerte", "en": "Alert", "es": "Alerta", "ar": "تنبيه"},
        "statusAttention": {"fr": "Attention", "en": "Warning", "es": "Atención", "ar": "انتباه"},
        "statusOk": {"fr": "OK", "en": "OK", "es": "OK", "ar": "جيد"},
        "monitoring": {"fr": "Surveillance", "en": "Monitoring", "es": "Supervisión", "ar": "مراقبة"},
        "monitoringTooltip": {
            "fr": "Mode anti-triche actif - Les comportements suspects sont enregistrés",
            "en": "Anti-cheat mode active - Suspicious behaviors are recorded",
            "es": "Modo anti-trampa activo - Los comportamientos sospechosos se registran",
            "ar": "وضع منع الغش نشط - يتم تسجيل السلوكيات المشبوهة",
        },
        "behaviorDetected": {
            "fr": "Comportement détecté",
            "en": "Behavior detected",
            "es": "Comportamiento detectado",
            "ar": "تم اكتشاف سلوك",
        },
        "tabSwitches": {
            "fr": "Changements d'onglet:",
            "en": "Tab switches:",
            "es": "Cambios de pestaña:",
            "ar": "تغييرات علامة التبويب:",
        },
        "focusLosses": {
            "fr": "Pertes de focus:",
            "en": "Focus losses:",
            "es": "Pérdidas de foco:",
            "ar": "فقدان التركيز:",
        },
        "warnings": {"fr": "Avertissements:", "en": "Warnings:", "es": "Advertencias:", "ar": "تحذيرات:"},
        "quizValidated": {
            "fr": "Quiz validé",
            "en": "Quiz validated",
            "es": "Cuestionario validado",
            "ar": "تم التحقق من الاختبار",
        },
        "noSuspicious": {
            "fr": "Aucun comportement suspect détecté. Résultat validé !",
            "en": "No suspicious behavior detected. Result validated!",
            "es": "No se detectó comportamiento sospechoso. ¡Resultado validado!",
            "ar": "لم يتم اكتشاف سلوك مشبوه. تم التحقق من النتيجة!",
        },
        "resultInvalidated": {
            "fr": "Résultat invalidé",
            "en": "Result invalidated",
            "es": "Resultado invalidado",
            "ar": "تم إبطال النتيجة",
        },
        "disqualifiedDescription": {
            "fr": "Des comportements suspects ont été détectés. Ce résultat ne sera pas comptabilisé.",
            "en": "Suspicious behaviors were detected. This result will not be counted.",
            "es": "Se detectaron comportamientos sospechosos. Este resultado no se contabilizará.",
            "ar": "تم اكتشاف سلوكيات مشبوهة. لن يتم احتساب هذه النتيجة.",
        },
        "warningsDetected": {
            "fr": "Avertissements détectés",
            "en": "Warnings detected",
            "es": "Advertencias detectadas",
            "ar": "تم اكتشاف تحذيرات",
        },
        "violationsRecorded": {
            "fr": "{count} comportement(s) suspect(s) enregistré(s).",
            "en": "{count} suspicious behavior(s) recorded.",
            "es": "{count} comportamiento(s) sospechoso(s) registrado(s).",
            "ar": "تم تسجيل {count} سلوكيات مشبوهة.",
        },
        "penaltyXp": {
            "fr": "Pénalité: -{xp} XP",
            "en": "Penalty: -{xp} XP",
            "es": "Penalización: -{xp} XP",
            "ar": "عقوبة: -{xp} نقطة خبرة",
        },
        "scoreAdjusted": {
            "fr": "Score ajusté: {original}% → {adjusted}%",
            "en": "Adjusted score: {original}% → {adjusted}%",
            "es": "Puntuación ajustada: {original}% → {adjusted}%",
            "ar": "النقاط المعدلة: {original}% ← {adjusted}%",
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
