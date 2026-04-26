# -*- coding: utf-8 -*-
"""
Add Arabic (MSA) translations to backend/app/core/spark_translations.py
- Sets SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es", "ar"]
- Inserts "ar" entries into each translation dictionary

This script edits the file in-place via line patterns (idempotent: detects existing "ar" keys).
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'backend', 'app', 'core', 'spark_translations.py')

# Map of section markers (Python comment) to AR content blocks.
# Each AR block is the EXACT text to insert just BEFORE the closing brace `}` of the dict.
# We rely on the fact that "es" is the last existing language in every dict.

# Helper: build "ar" list block
def ar_list_block(messages):
    out = '        "ar": [\n'
    for m in messages:
        # escape backslashes and double-quotes
        esc = m.replace('\\', '\\\\').replace('"', '\\"')
        out += f'            "{esc}",\n'
    out += '        ],\n'
    return out


def ar_dict_block(d):
    out = '        "ar": {\n'
    for k, v in d.items():
        esc_v = v.replace('\\', '\\\\').replace('"', '\\"')
        out += f'            "{k}": "{esc_v}",\n'
    out += '        },\n'
    return out


# All AR translations (MSA - Modern Standard Arabic)
AR_DATA = {
    'STREAK_REMINDER_14H': ar_list_block([
        "مرحبًا، أنا سبارك! 🐿️ سلسلتك التي مدتها {streak} أيام تثير إعجابي! هل نواصل معًا؟",
        "أهلاً بطلي! سلسلتك التي مدتها {streak} أيام رائعة. جلسة دراسية صغيرة بعد الظهر؟ 📚",
        "مرحبًا! 🌟 {streak} أيام متتالية، أنت رائع! أنتظرك لنذاكر معًا!",
        "أهلاً! شعلتك التي مدتها {streak} أيام تتوهج! 🔥 حافظ عليها اليوم!",
    ]),
    'STREAK_REMINDER_19H_NORMAL': ar_list_block([
        "حسنًا... 😟 لم تذاكر بعد اليوم! سلسلتك التي مدتها {streak} أيام ستختفي!",
        "تنبيه! 🚨 سبارك هنا! سلسلتك التي مدتها {streak} أيام في خطر! تعال بسرعة!",
        "بدأت أقلق... 😰 {streak} أيام من العمل ستضيع إذا لم تعد!",
        "هل نسيتني؟ 🥺 سلسلتك التي مدتها {streak} أيام تبكي في الزاوية...",
    ]),
    'STREAK_REMINDER_URGENT': ar_list_block([
        "طوارئ كاملة! 😱 لم يتبق سوى ساعات قليلة! أيامك الـ {streak} ستختفي!",
        "أنا في حالة هلع! 🆘 سلسلتك التي مدتها {streak} أيام تموت! عُد الآن!",
        "الفرصة الأخيرة! 😭 لا أريد أن أرى سلسلتك التي مدتها {streak} أيام تنهار!",
        "هل هذه النهاية؟! 💔 لا لا لا! أنقذ أيامك الـ {streak} قبل فوات الأوان!",
    ]),
    'STREAK_REMINDER_TITLES': ar_dict_block({
        "normal": "تحية من سبارك! 🐿️",
        "worried": "سبارك قلق عليك! 😟",
        "urgent": "سبارك يائس! 😱🔥",
    }),
    'STREAK_LOST_LONG': ar_list_block([
        "💔 {streak} يومًا... كل هذا العمل... لا أصدق...",
        "*ينتحب* 😭 {streak} يومًا معًا، ذهبت أدراج الرياح... أنا محطم...",
        "لا... ليس {streak} يومًا... سبارك يحتاج لحظة... 😢💔",
    ]),
    'STREAK_LOST_MEDIUM': ar_list_block([
        "😢 لا... سلسلتك التي مدتها {streak} أيام اختفت... أنا حزين جدًا...",
        "*يشهق* {streak} أيام متتالية... كانت جميلة ما دامت... 😿",
        "شعلتك التي مدتها {streak} أيام انطفأت... 🕯️ سبارك يعبس في زاويته...",
    ]),
    'STREAK_LOST_SHORT': ar_list_block([
        "أوه... سلسلتك التي مدتها {streak} أيام انتهت. هل نبدأ من جديد؟ 🌱",
        "حسنًا... {streak} أيام كانت جيدة! مستعد لبداية جديدة؟ 💪",
        "سلسلتك التي مدتها {streak} أيام طارت... لكن سبارك يؤمن بك! 🐿️",
    ]),
    'STREAK_LOST_TITLES': ar_dict_block({
        "long": "سبارك محطم 💔😭",
        "medium": "سبارك حزين 😢",
        "short": "ضاعت السلسلة... 😔",
    }),
    'STREAK_MILESTONE_MESSAGES': ar_dict_block({
        "7": "🐿️✨ أسبوع! سبارك يرقص رقصة النصر! أنت رائع!",
        "14": "⚡🔥 أسبوعان! أنا فخور جدًا بك! *يقفز فرحًا*",
        "30": "🏆🎊 شهر كامل! سبارك يبكي من الفرح! أنت بطلي!",
        "60": "💎👑 شهران! *ينفجر سعادة* أنت آلة!",
        "100": "🌟🏅 مئة يوم! سبارك بلا كلام... أنت أسطورة حية!",
        "365": "👑🎆🌟 سنة!!! لا أصدق!!! أنت الأفضل على الإطلاق!!!",
    }),
    'STREAK_MILESTONE_TITLES': ar_dict_block({
        "7": "سبارك يحتفل! 🎉🐿️",
        "14": "سبارك في السحاب! ✨",
        "30": "سبارك يفيض فخرًا! 🏆",
        "60": "سبارك في نشوة! 💎",
        "100": "سبارك يبكي من الفرح! 👑",
        "365": "سبارك في الجنة! 🌟",
    }),
    'FLASHCARD_REMINDER_HIGH': ar_list_block([
        "😱 {count} بطاقة في انتظارك! سبارك يخشى أن تهرب!",
        "رائع! {count} بطاقة! إنها كثيرة لكن سبارك يؤمن بك! 💪",
        "🌋 {count} بطاقة تنفجر! تعال وروضها معي!",
    ]),
    'FLASHCARD_REMINDER_MEDIUM': ar_list_block([
        "مرحبًا! {count} بطاقة تريد التحدث معك! 🎴",
        "بطاقاتك الـ {count} تشتاق إليك! تعال والعب! 🐿️",
        "سبارك حضّر {count} بطاقة من أجلك! 💝",
    ]),
    'FLASHCARD_REMINDER_LOW': ar_list_block([
        "أهلاً! {count} بطاقات صغيرة تنتظرك! 🌸",
        "جلسة قصيرة من {count} بطاقة، ما رأيك؟ 🐿️",
        "لدى سبارك {count} بطاقة ليريك إياها! تعال شاهد! ✨",
    ]),
    'FLASHCARD_REMINDER_TITLES': ar_dict_block({
        "high": "سبارك يحتاجك! 📚🐿️",
        "medium": "مراجعات اليوم! 📚",
        "low": "تذكير صغير من سبارك! 🐿️",
    }),
    'ACHIEVEMENT_UNLOCKED': ar_dict_block({
        "title": "تم فتح إنجاز! 🏆",
        "message": "لقد فتحت '{name}'! +{xp} نقطة خبرة",
    }),
    'LEVEL_UP': ar_dict_block({
        "title": "وصلت إلى المستوى {level}! 🎉",
        "message": "تهانينا! أنت الآن في المستوى {level}!",
    }),
    'DUEL_CHALLENGE': ar_dict_block({
        "title": "تحدٍ جديد! ⚔️",
        "message": "{challenger} يتحداك! الرهان: {xp} نقطة خبرة",
    }),
    'FOCUS_ROOM_INVITE': ar_dict_block({
        "title": "دعوة لغرفة التركيز 📚",
        "message": "{inviter} يدعوك للانضمام إلى غرفة '{room}'",
    }),
    'FOCUS_ROOM_INVITE_ACCEPTED': ar_dict_block({
        "title": "تم قبول الدعوة! 🎉",
        "message": "{invitee} انضم إلى غرفتك '{room}'",
    }),
    'EVENT_REMINDER': ar_dict_block({
        "title_exam": "امتحان {time}!",
        "title_deadline": "موعد نهائي {time}!",
        "title_default": "{type} {time}",
        "message_exam": "'{event}' يبدأ في {date} الساعة {hour}",
        "message_deadline": "'{event}' ينتهي في {date} الساعة {hour}",
        "message_default": "'{event}' يبدأ الساعة {hour}",
    }),
    'EVENT_TYPE_LABELS': ar_dict_block({
        "exam": "امتحان",
        "class": "حصة",
        "deadline": "موعد نهائي",
        "study": "جلسة دراسية",
        "meeting": "اجتماع",
        "other": "حدث",
    }),
    'LEAGUE_TIER_NAMES': ar_dict_block({
        "bronze": "البرونزي",
        "silver": "الفضي",
        "gold": "الذهبي",
        "diamond": "الماسي",
        "master": "الخبير",
    }),
    'LEAGUE_PROMOTION': ar_dict_block({
        "title": "🎉 ترقية! دوري {to_tier}!",
        "message": "تهانينا! تنتقل من دوري {from_tier} إلى دوري {to_tier}! سبارك فخور بك جدًا! 🐿️⭐",
    }),
    'LEAGUE_DEMOTION': ar_dict_block({
        "title": "😔 تنزيل - دوري {to_tier}",
        "message": "تنزل إلى دوري {to_tier}... لكن لا تقلق! سبارك يؤمن بقدرتك على الصعود! 🐿️💪",
    }),
}

# Special handling for INACTIVITY_REMINDER (nested dict)
INACTIVITY_AR = {
    "3_days": {
        "title": "🐿️ سبارك يفتقدك!",
        "message": "مرحبًا، مرت 3 أيام منذ آخر لقاء لنا! سلسلتك في خطر... عُد بسرعة لجلسة قصيرة! 📚",
        "email_subject": "🐿️ سبارك يفتقدك!",
    },
    "7_days": {
        "title": "😢 سبارك يبحث عنك...",
        "message": "أسبوع كامل بدونك... بطاقاتك تتراكم وسبارك حزين! فقط 5 دقائق اليوم؟ 🥺",
        "email_subject": "مر أسبوع... هل ستعود؟ 📚",
    },
    "14_days": {
        "title": "💔 سبارك لم ينساك!",
        "message": "أسبوعان مرّا! أصدقاؤك يواصلون التقدم. عُد وأظهر ما تستطيع! 💪",
        "email_subject": "نشتاق إليك في ستوديرا!",
    },
    "30_days": {
        "title": "🐿️ سبارك لا يزال ينتظر...",
        "message": "شهر بدون دراسة... لكن لم يفت الأوان أبدًا للبدء من جديد! سبارك دائمًا هنا من أجلك 🐿️❤️",
        "email_subject": "لم يفت الأوان للعودة! 🐿️",
    },
}


def main():
    with io.open(TARGET, encoding='utf-8') as f:
        text = f.read()

    if 'SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es", "ar"]' in text:
        print('Already updated. Aborting (idempotent).')
        return

    # 1. Update SPARK_SUPPORTED_LANGUAGES
    text = text.replace(
        'SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es"]',
        'SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es", "ar"]',
        1,
    )

    # 2. Update header comment
    text = text.replace(
        'Supporte: français (fr), anglais (en), espagnol (es)',
        'Supporte: français (fr), anglais (en), espagnol (es), arabe (ar)',
        1,
    )

    # 3. Update get_spark_language docstring
    text = text.replace(
        'Returns:\n        Code de langue supporté par Spark (fr, en, es) ou "fr" par défaut',
        'Returns:\n        Code de langue supporté par Spark (fr, en, es, ar) ou "fr" par défaut',
        1,
    )

    # 4. For each dict, find the "es" block and inject "ar" right after it (before the closing brace).
    # Strategy: find the dict declaration line, then locate the next standalone "    }" line that closes it,
    # and insert AR_DATA[name] just before that line.

    for name, ar_block in AR_DATA.items():
        # Pattern: name: Dict[...] = {  ...  }
        # We find the start, then walk forward to count braces.
        idx = text.find(f'{name}:')
        if idx == -1:
            print(f'WARN: {name} not found')
            continue
        # Find first '{' after the name
        brace_open = text.find('{', idx)
        if brace_open == -1:
            print(f'WARN: opening brace not found for {name}')
            continue
        # Walk forward counting braces
        depth = 1
        i = brace_open + 1
        while i < len(text) and depth > 0:
            c = text[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        if depth != 0:
            print(f'WARN: closing brace not found for {name}')
            continue
        # i now points to the closing '}' of the outer dict
        # Walk backwards to start of that line (find preceding newline)
        line_start = text.rfind('\n', 0, i) + 1
        # Insert ar_block before line_start
        text = text[:line_start] + ar_block + text[line_start:]

    # 5. Special handling for INACTIVITY_REMINDER (nested dict, can't use the generic function easily).
    #    Replace it from scratch.
    inactivity_ar_str = '    "ar": {\n'
    for period, fields in INACTIVITY_AR.items():
        inactivity_ar_str += f'        "{period}": {{\n'
        for k, v in fields.items():
            esc_v = v.replace('\\', '\\\\').replace('"', '\\"')
            inactivity_ar_str += f'            "{k}": "{esc_v}",\n'
        inactivity_ar_str += '        },\n'
    inactivity_ar_str += '    },\n'

    # Find INACTIVITY_REMINDER's outer closing brace and inject before it
    idx = text.find('INACTIVITY_REMINDER:')
    if idx != -1:
        brace_open = text.find('{', idx)
        depth = 1
        i = brace_open + 1
        while i < len(text) and depth > 0:
            c = text[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        line_start = text.rfind('\n', 0, i) + 1
        # Adjust indentation: INACTIVITY block is inside class (8-space indent for outer entries)
        # We need the ar block at 8-space level
        ar_indented = '        "ar": {\n'
        for period, fields in INACTIVITY_AR.items():
            ar_indented += f'            "{period}": {{\n'
            for k, v in fields.items():
                esc_v = v.replace('\\', '\\\\').replace('"', '\\"')
                ar_indented += f'                "{k}": "{esc_v}",\n'
            ar_indented += '            },\n'
        ar_indented += '        },\n'
        text = text[:line_start] + ar_indented + text[line_start:]

    # Hack: STREAK_MILESTONE_MESSAGES and STREAK_MILESTONE_TITLES use int keys, not string keys.
    # Our generated block used string keys. Fix them.
    text = text.replace('"7":', '7:')  # safe within milestone blocks
    text = text.replace('"14":', '14:')
    text = text.replace('"30":', '30:')
    text = text.replace('"60":', '60:')
    text = text.replace('"100":', '100:')
    text = text.replace('"365":', '365:')

    with io.open(TARGET, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'Updated {TARGET}')


if __name__ == '__main__':
    main()
