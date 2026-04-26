# -*- coding: utf-8 -*-
"""
Build frontend/messages/ar.json with the same structure as en.json.

Strategy:
- Walk en.json structure recursively.
- For each leaf path, look up the Arabic translation in AR_DICT below.
- If not found, fall back to the English value (so the UI never breaks
  with `path` strings, and missing translations are obvious to translators).

This is a best-effort Modern Standard Arabic (MSA) translation focused on
the most visible UI sections. Long marketing/legal/privacy copy is
intentionally kept in English as a fallback so it can be progressively
translated by human translators.
"""
import json
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')


# ---------------------------------------------------------------------------
# Arabic translations keyed by full dotted path
# ---------------------------------------------------------------------------
AR_DICT = {
    # ---- $schema ---------------------------------------------------------
    "$schema": "https://inlang.com/schema/inlang-message-format",

    # ---- common ----------------------------------------------------------
    "common.appName": "Studera",
    "common.loading": "جارٍ التحميل...",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.create": "إنشاء",
    "common.search": "بحث",
    "common.filter": "تصفية",
    "common.sort": "ترتيب",
    "common.back": "رجوع",
    "common.next": "التالي",
    "common.previous": "السابق",
    "common.close": "إغلاق",
    "common.confirm": "تأكيد",
    "common.yes": "نعم",
    "common.no": "لا",
    "common.or": "أو",
    "common.and": "و",
    "common.all": "الكل",
    "common.none": "لا شيء",
    "common.error": "خطأ",
    "common.success": "نجاح",
    "common.warning": "تحذير",
    "common.info": "معلومة",
    "common.upgrade_premium": "الترقية إلى المميز",
    "common.upgrade": "الترقية إلى المميز",
    "common.optional": "اختياري",

    # ---- auth ------------------------------------------------------------
    "auth.login": "تسجيل الدخول",
    "auth.logout": "تسجيل الخروج",
    "auth.register": "إنشاء حساب",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.confirmPassword": "تأكيد كلمة المرور",
    "auth.username": "اسم المستخدم",
    "auth.fullName": "الاسم الكامل",
    "auth.forgotPassword": "نسيت كلمة المرور؟",
    "auth.resetPassword": "إعادة تعيين كلمة المرور",
    "auth.noAccount": "ليس لديك حساب؟",
    "auth.hasAccount": "لديك حساب بالفعل؟",
    "auth.loginSuccess": "تم تسجيل الدخول بنجاح!",
    "auth.logoutSuccess": "تم تسجيل الخروج بنجاح",
    "auth.registerSuccess": "تم التسجيل بنجاح! مرحبًا بك في Studera",
    "auth.invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "auth.emailRequired": "البريد الإلكتروني مطلوب",
    "auth.passwordRequired": "كلمة المرور مطلوبة",
    "auth.passwordMinLength": "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل",
    "auth.forgotPasswordTitle": "نسيت كلمة المرور",
    "auth.forgotPasswordSubtitle": "أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين",
    "auth.sendResetLink": "إرسال رابط إعادة التعيين",
    "auth.resetLinkSent": "إذا كان هذا البريد الإلكتروني مرتبطًا بحساب، فقد تم إرسال رابط إعادة التعيين.",
    "auth.checkEmail": "تحقق من بريدك الوارد",
    "auth.backToLogin": "العودة إلى تسجيل الدخول",
    "auth.resetPasswordTitle": "كلمة مرور جديدة",
    "auth.resetPasswordSubtitle": "اختر كلمة مرور جديدة لحسابك",
    "auth.newPassword": "كلمة المرور الجديدة",
    "auth.confirmNewPassword": "تأكيد كلمة المرور الجديدة",
    "auth.resetPasswordButton": "إعادة تعيين كلمة المرور",
    "auth.passwordResetSuccess": "تمت إعادة تعيين كلمة المرور بنجاح!",
    "auth.passwordsDoNotMatch": "كلمتا المرور غير متطابقتين",
    "auth.invalidResetToken": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية",
    "auth.noResetToken": "لم يتم تقديم رمز إعادة تعيين",

    # ---- nav -------------------------------------------------------------
    "nav.dashboard": "لوحة التحكم",
    "nav.explore": "استكشاف",
    "nav.quests": "المهام اليومية",
    "nav.subjects": "المواد",
    "nav.documents": "المستندات",
    "nav.notes": "الملاحظات",
    "nav.flashcards": "البطاقات التعليمية",
    "nav.quizzes": "الاختبارات",
    "nav.calendar": "التقويم",
    "nav.groups": "المجموعات",
    "nav.profile": "الملف الشخصي",
    "nav.settings": "الإعدادات",
    "nav.help": "مساعدة",
    "nav.spark": "مركز الذكاء الاصطناعي",
    "nav.sessions": "الجلسات",
    "nav.focusRooms": "غرف التركيز",
    "nav.achievements": "الإنجازات",
    "nav.duels": "المبارزات",
    "nav.leaderboard": "لوحة المتصدرين",
    "nav.export": "تصدير",
    "nav.pricing": "الأسعار",
    "nav.examMode": "وضع الامتحان",
    "nav.category.main": "الرئيسية",
    "nav.category.study": "الدراسة",
    "nav.category.tools": "الأدوات",
    "nav.category.social": "اجتماعي",
    "nav.category.more": "المزيد",

    # ---- errors ----------------------------------------------------------
    "errors.generic": "حدث خطأ",
    "errors.network": "خطأ في الاتصال",
    "errors.notFound": "الصفحة غير موجودة",
    "errors.unauthorized": "غير مصرح",
    "errors.forbidden": "الوصول مرفوض",
    "errors.serverError": "خطأ في الخادم",
    "errors.tryAgain": "يرجى المحاولة مرة أخرى",

    # ---- empty -----------------------------------------------------------
    "empty.title": "لا يوجد عنصر",
    "empty.description": "لا توجد عناصر للعرض حاليًا.",
    "empty.action": "إنشاء عنصر",

    # ---- time ------------------------------------------------------------
    "time.justNow": "الآن",
    "time.minutesAgo": "منذ {count} د",
    "time.hoursAgo": "منذ {count} س",
    "time.daysAgo": "منذ {count} يوم",
    "time.yesterday": "أمس",
    "time.weeksAgo": "منذ {count} أسبوع",
    "time.monthsAgo": "منذ {count} شهر",
    "time.secondsAgo": "منذ {count} ث",

    # ---- settings --------------------------------------------------------
    "settings.title": "الإعدادات",
    "settings.subtitle": "إدارة تفضيلاتك وإعدادات حسابك",
    "settings.profile": "الملف الشخصي",
    "settings.account": "الحساب",
    "settings.preferences": "التفضيلات",
    "settings.notifications": "الإشعارات",
    "settings.privacy": "الخصوصية",
    "settings.security": "الأمان",
    "settings.appearance": "المظهر",
    "settings.language": "اللغة",
    "settings.theme": "النمط",
    "settings.themeLight": "فاتح",
    "settings.themeDark": "داكن",
    "settings.themeSystem": "النظام",
    "settings.deleteAccount": "حذف الحساب",
    "settings.deleteAccountConfirm": "هل أنت متأكد أنك تريد حذف حسابك؟ هذا الإجراء لا يمكن التراجع عنه.",
    "settings.deleteAccountSuccess": "تم حذف الحساب بنجاح",
    "settings.savedSuccess": "تم حفظ الإعدادات",
    "settings.saveError": "خطأ أثناء الحفظ",
    "settings.exportData": "تصدير بياناتي",
    "settings.changePassword": "تغيير كلمة المرور",
    "settings.timezone": "المنطقة الزمنية",

    # ---- profile ---------------------------------------------------------
    "profile.title": "الملف الشخصي",
    "profile.bio": "السيرة الذاتية",
    "profile.bioPlaceholder": "أخبرنا قليلًا عن نفسك...",
    "profile.editProfile": "تعديل الملف الشخصي",
    "profile.changeAvatar": "تغيير الصورة الرمزية",
    "profile.statsTitle": "إحصائياتك",
    "profile.joinedAt": "انضم في",
    "profile.level": "المستوى",
    "profile.xp": "نقاط الخبرة",
    "profile.streak": "السلسلة",
    "profile.statsSubtitle": "نظرة عامة على نشاطك",

    # ---- dashboard -------------------------------------------------------
    "dashboard.welcome": "مرحبًا، {name}!",
    "dashboard.welcomeBack": "مرحبًا بعودتك!",
    "dashboard.subtitle": "إليك نظرة عامة على نشاطك",
    "dashboard.quickActions": "إجراءات سريعة",
    "dashboard.recentActivity": "النشاط الأخير",
    "dashboard.upcomingEvents": "الأحداث القادمة",
    "dashboard.studyStats": "إحصائيات الدراسة",
    "dashboard.todayStreak": "سلسلتك اليوم",
    "dashboard.continueLearning": "متابعة التعلم",
    "dashboard.noRecentActivity": "لا يوجد نشاط حديث",
    "dashboard.startLearning": "ابدأ التعلم",
    "dashboard.totalNotes": "إجمالي الملاحظات",
    "dashboard.totalFlashcards": "إجمالي البطاقات",
    "dashboard.totalQuizzes": "إجمالي الاختبارات",
    "dashboard.studyTime": "وقت الدراسة",
    "dashboard.viewAll": "عرض الكل",
    "dashboard.weeklyProgress": "التقدم الأسبوعي",

    # ---- notifications --------------------------------------------------
    "notifications.title": "الإشعارات",
    "notifications.empty": "لا توجد إشعارات",
    "notifications.markAllRead": "تعليم الكل كمقروء",
    "notifications.markRead": "تعليم كمقروء",
    "notifications.viewAll": "عرض كل الإشعارات",
    "notifications.unread": "غير مقروء",
    "notifications.read": "مقروء",
    "notifications.delete": "حذف",
    "notifications.subtitle": "تابع نشاط حسابك",
    "notifications.noNotifications": "لا يوجد لديك إشعارات",

    # ---- search / global --------------------------------------------------
    "search.empty": "لا توجد نتائج",

    # ---- offline (page) ---------------------------------------------------
    "offline.title": "غير متصل بالإنترنت",
    "offline.description": "يبدو أنك غير متصل بالإنترنت حاليًا.",
    "offline.retry": "إعادة المحاولة",
    "offline.indicator.online": "متصل",
    "offline.indicator.offline": "غير متصل",
    "offline.indicator.syncing": "جارٍ المزامنة...",
    "offline.indicator.synced": "تمت المزامنة",
    "offline.indicator.pendingChanges": "{count} تغييرات معلقة",

    # ---- cookies ----------------------------------------------------------
    "cookies.title": "نحن نستخدم ملفات تعريف الارتباط",
    "cookies.description": "نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك إدارة تفضيلاتك في أي وقت.",
    "cookies.accept": "قبول الكل",
    "cookies.reject": "رفض الكل",
    "cookies.customize": "تخصيص",
    "cookies.essential": "أساسية",
    "cookies.analytics": "تحليلية",
    "cookies.marketing": "تسويقية",
    "cookies.save": "حفظ التفضيلات",
    "cookies.learnMore": "اعرف المزيد",

    # ---- editor errors ---------------------------------------------------
    "editor.errors.imageUpload": "خطأ أثناء رفع الصورة",
    "editor.errors.imageSize": "حجم الصورة كبير جدًا",
    "editor.errors.imageType": "نوع الصورة غير مدعوم",
    "editor.errors.unknown": "حدث خطأ غير متوقع",

    # ---- groups (additions) ----------------------------------------------
    "groups.flashcards.empty": "لا توجد بطاقات تعليمية في هذه المجموعة",
    "groups.flashcards.create": "إنشاء بطاقات",
    "groups.activity.empty": "لا يوجد نشاط في هذه المجموعة",
    "groups.activity.recent": "النشاط الأخير",

    # ---- focusRoom (additions) -------------------------------------------
    "focusRoom.events.empty": "لا توجد فعاليات قادمة",
    "focusRoom.events.duration15": "15 دقيقة",
    "focusRoom.events.duration30": "30 دقيقة",
    "focusRoom.events.duration60": "60 دقيقة",
    "focusRoom.events.duration90": "90 دقيقة",
    "focusRoom.events.duration120": "120 دقيقة",
    "focusRoom.events.categoryStudy": "دراسة",
    "focusRoom.events.categoryWork": "عمل",
    "focusRoom.events.categoryReading": "قراءة",
    "focusRoom.deepWork.started": "بدأ وضع العمل العميق",
    "focusRoom.deepWork.ended": "انتهى وضع العمل العميق",
    "focusRoom.deepWork.paused": "تم إيقاف الجلسة مؤقتًا",
    "focusRoom.deepWork.resumed": "تم استئناف الجلسة",
    "focusRoom.deepWork.error": "تعذر بدء الجلسة",

    # ---- antiCheat -------------------------------------------------------
    "antiCheat.warning": "تم اكتشاف نشاط مشبوه",
    "antiCheat.tabSwitch": "تم اكتشاف تغيير علامة التبويب",
    "antiCheat.fullscreenExit": "تم الخروج من وضع ملء الشاشة",

    # ---- metadata --------------------------------------------------------
    "metadata.title": "Studera - مساعدك الذكي للتعلم",
    "metadata.description": "تطبيق تعلم يجمع بين الذكاء الاصطناعي والبطاقات التعليمية والاختبارات والتلعيب",
    "metadata.keywords": "دراسة, تعلم, ذكاء اصطناعي, بطاقات تعليمية, اختبارات, ملاحظات",

    # ---- dashboard (full) ------------------------------------------------
    "dashboard.todayStats": "إحصائيات اليوم",
    "dashboard.totalStudyTime": "إجمالي وقت الدراسة",
    "dashboard.thisMonth": "هذا الشهر",
    "dashboard.studyStreak": "سلسلة الدراسة",
    "dashboard.days": "أيام",
    "dashboard.xpEarned": "نقاط الخبرة المكتسبة",
    "dashboard.level": "المستوى",
    "dashboard.flashcardsDue": "بطاقات للمراجعة",
    "dashboard.quizzesTodo": "اختبارات للقيام بها",
    "dashboard.upcomingExams": "امتحانات قادمة",
    "dashboard.noActivity": "لا يوجد نشاط حديث",
    "dashboard.startStudying": "ابدأ الدراسة",

    # ---- tooltips --------------------------------------------------------
    "tooltips.dashboard.xp": "احصل على نقاط الخبرة بإكمال الاختبارات والبطاقات. ارفع مستواك لفتح الإنجازات!",
    "tooltips.dashboard.streak": "ادرس يوميًا للحفاظ على سلسلتك. السلاسل تعزز التحفيز والمكافآت!",
    "tooltips.dashboard.studyTime": "إجمالي الوقت المخصص للدراسة. ثباتك مهم!",
    "tooltips.dashboard.flashcardsDue": "بطاقات تنتظر المراجعة اليوم وفقًا لخوارزمية التكرار المتباعد. راجعها لتحسين الحفظ!",
    "tooltips.dashboard.addDeck": "أنشئ مجموعة بطاقات تعليمية لتعلم نشط وفعال",
    "tooltips.dashboard.addQuiz": "أنشئ اختبارًا لتقييم معرفتك ومتابعة تقدمك",
    "tooltips.dashboard.spark": "مساعد ذكاء اصطناعي يساعدك على الفهم والتلخيص وإنشاء محتوى تعليمي",
    "tooltips.dashboard.sessions": "استخدم تقنية بومودورو لجلسات دراسة مركزة",
    "tooltips.subjects.color": "اختر لونًا للتعرف بصريًا على موادك",
    "tooltips.subjects.description": "اوصف محتوى المادة أو أهدافك. هذا يساعد في تنظيم دراستك.",
    "tooltips.subjects.notes": "ملاحظات الدراسة المنشأة في هذه المادة",
    "tooltips.subjects.docs": "المستندات والموارد المستوردة",
    "tooltips.subjects.cards": "مجموعات البطاقات لهذه المادة",
    "tooltips.subjects.quiz": "اختبارات لتقييم معرفتك",
    "tooltips.notes.search": "ابحث بالعنوان أو المحتوى أو العلامات. اعثر على ما تبحث عنه بدقة.",
    "tooltips.notes.favorites": "اعرض ملاحظاتك المفضلة فقط للوصول السريع للمحتوى المهم",
    "tooltips.notes.tags": "العلامات تساعد في تنظيم الملاحظات حسب الموضوع. استخدمها لتصنيف أفضل.",
    "tooltips.notes.view": "عرض الملاحظة كاملة",
    "tooltips.notes.edit": "تعديل هذه الملاحظة",
    "tooltips.notes.delete": "حذف هذه الملاحظة نهائيًا",
    "tooltips.flashcards.cardsDue": "بطاقات مجدولة للمراجعة اليوم. ادرسها لتحسين الحفظ!",
    "tooltips.flashcards.totalCards": "إجمالي عدد البطاقات في جميع مجموعاتك",
    "tooltips.flashcards.mastered": "نسبة البطاقات التي أتقنتها بفضل التكرار",
    "tooltips.flashcards.spacedRepetition": "التكرار المتباعد يجدول مراجعاتك لتحسين الحفظ. ادرس البطاقات في موعدها للحصول على أفضل النتائج!",
    "tooltips.flashcards.review": "راجع البطاقات المستحقة اليوم",
    "tooltips.flashcards.viewDeck": "عرض جميع بطاقات المجموعة وإدارتها",
    "tooltips.flashcards.progress": "تقدمك: نسبة البطاقات المتقنة. واصل الدراسة لرفع هذه النسبة!",
    "tooltips.quizzes.attempts": "العدد الإجمالي للمرات التي أجريت فيها أي اختبار",
    "tooltips.quizzes.completed": "عدد الاختبارات التي أكملتها",
    "tooltips.quizzes.avgScore": "متوسط نقاطك في جميع الاختبارات المكتملة",
    "tooltips.quizzes.timeLimit": "الوقت الأقصى المسموح به. ∞ = بدون حد زمني",
    "tooltips.quizzes.share": "شارك هذا الاختبار لإنشاء لوحة متصدرين وتحدي أصدقائك!",
    "tooltips.quizzes.leaderboard": "اعرف أداء الآخرين في هذا الاختبار المشترك",
    "tooltips.quizzes.bestScore": "أعلى نقاطك في هذا الاختبار. حاول تحطيمها!",
    "tooltips.emptyStates.subjects": "المواد تنظم كل محتواك: ملاحظات، بطاقات، اختبارات. ابدأ بإنشاء واحدة!",
    "tooltips.emptyStates.notes": "ستظهر ملاحظاتك الدراسية هنا. أنشئ ملاحظتك الأولى للبدء!",
    "tooltips.emptyStates.flashcards": "البطاقات التعليمية من أكثر طرق الدراسة فعالية. أنشئ مجموعتك الأولى!",
    "tooltips.emptyStates.quizzes": "أنشئ اختبارات لتقييم معرفتك ومتابعة تقدمك!",
    "tooltips.emptyStates.activity": "سيظهر نشاط دراستك هنا. ابدأ بإنشاء ملاحظات، بطاقات أو اختبارات!",
    "tooltips.emptyStates.events": "لا توجد أحداث قادمة. زر التقويم لجدولة جلسات الدراسة أو الامتحانات.",

    # ---- onboarding ------------------------------------------------------
    "onboarding.step": "خطوة",
    "onboarding.skip": "تخطي",
    "onboarding.start": "ابدأ",
    "onboarding.welcome.title": "مرحبًا بك في Studera! 🎉",
    "onboarding.welcome.subtitle": "منصتك الذكية للتعلم",
    "onboarding.welcome.description": "في خطوات قليلة، ستقوم بإعداد مساحتك الدراسية الشخصية واكتشاف ميزات ستغير طريقة تعلمك.",
    "onboarding.subjects.title": "أنشئ موادك 📚",
    "onboarding.subjects.subtitle": "كل شيء يبدأ هنا!",
    "onboarding.subjects.description": "المواد هي قلب Studera. تنظم ملاحظاتك وبطاقاتك واختباراتك وكل محتواك. أنشئ مادة واحدة على الأقل للبدء.",
    "onboarding.features.title": "اكتشف الأدوات 🛠️",
    "onboarding.features.subtitle": "كل ما تحتاجه",
    "onboarding.features.description": "يجمع Studera كل الأدوات اللازمة للنجاح في دراستك.",
    "onboarding.gamification.title": "تعلم بمتعة 🎮",
    "onboarding.gamification.subtitle": "نقاط ومستويات ومكافآت",
    "onboarding.gamification.description": "اكسب نقاط الخبرة مع كل إجراء، ارفع مستواك، افتح الإنجازات وتحدَ أصدقاءك في المبارزات!",
    "onboarding.ready.title": "أنت جاهز! 🚀",
    "onboarding.ready.subtitle": "ابدأ مغامرتك",
    "onboarding.ready.description": "تم إعداد مساحتك. حان الوقت لإنشاء ملاحظتك الأولى أو بطاقاتك!",

    # ---- subjects --------------------------------------------------------
    "subjects.title": "المواد",
    "subjects.subtitle": "نظم محتواك حسب المادة",
    "subjects.create": "إنشاء مادة",
    "subjects.edit": "تعديل المادة",
    "subjects.delete": "حذف المادة",
    "subjects.name": "اسم المادة",
    "subjects.description": "الوصف",
    "subjects.color": "اللون",
    "subjects.empty": "لا توجد مواد بعد",
    "subjects.emptyDescription": "أنشئ مادتك الأولى لتنظيم محتواك",
    "subjects.namePlaceholder": "مثل: الرياضيات، التاريخ، البرمجة...",
    "subjects.descriptionPlaceholder": "وصف مختصر للمادة...",
    "subjects.deleteConfirm": "هل أنت متأكد من حذف هذه المادة؟",
    "subjects.deleteWarning": "سيتم حذف كل المحتوى المرتبط بها.",
    "subjects.created": "تم إنشاء المادة",
    "subjects.updated": "تم تحديث المادة",
    "subjects.deleted": "تم حذف المادة",
    "subjects.notesCount": "{count} ملاحظات",
    "subjects.flashcardsCount": "{count} بطاقات",
    "subjects.quizzesCount": "{count} اختبارات",

    # ---- notes (lite) ----------------------------------------------------
    "notes.create": "إنشاء ملاحظة",
    "notes.edit": "تعديل الملاحظة",
    "notes.delete": "حذف الملاحظة",
    "notes.title": "العنوان",
    "notes.content": "المحتوى",
    "notes.tags": "العلامات",
    "notes.subject": "المادة",
    "notes.created": "تم إنشاء الملاحظة",
    "notes.updated": "تم تحديث الملاحظة",
    "notes.deleted": "تم حذف الملاحظة",
    "notes.deleteConfirm": "هل أنت متأكد من حذف هذه الملاحظة؟",
    "notes.empty": "لا توجد ملاحظات",
    "notes.emptyDescription": "أنشئ ملاحظتك الأولى",
    "notes.search": "ابحث في الملاحظات...",
    "notes.favorites": "المفضلة",

    # ---- flashcards (lite) -----------------------------------------------
    "flashcards.title": "البطاقات التعليمية",
    "flashcards.subtitle": "تعلم بفعالية مع التكرار المتباعد",
    "flashcards.create": "إنشاء مجموعة",
    "flashcards.edit": "تعديل المجموعة",
    "flashcards.delete": "حذف المجموعة",
    "flashcards.deck": "المجموعة",
    "flashcards.cards": "البطاقات",
    "flashcards.front": "الوجه الأمامي",
    "flashcards.back": "الوجه الخلفي",
    "flashcards.review": "مراجعة",
    "flashcards.study": "ادرس",
    "flashcards.again": "مرة أخرى",
    "flashcards.hard": "صعب",
    "flashcards.good": "جيد",
    "flashcards.easy": "سهل",
    "flashcards.empty": "لا توجد بطاقات",
    "flashcards.emptyDescription": "أنشئ بطاقاتك الأولى",
    "flashcards.deleteConfirm": "هل أنت متأكد من حذف هذه المجموعة؟",
    "flashcards.created": "تم الإنشاء",
    "flashcards.updated": "تم التحديث",
    "flashcards.deleted": "تم الحذف",
    "flashcards.cardsCount": "{count} بطاقات",
    "flashcards.cardsDue": "{count} للمراجعة",
    "flashcards.mastered": "تم إتقانها",
    "flashcards.progress": "التقدم",

    # ---- quiz (lite) ----------------------------------------------------
    "quiz.title": "الاختبار",
    "quiz.subtitle": "قيّم معرفتك",
    "quiz.start": "بدء الاختبار",
    "quiz.next": "السؤال التالي",
    "quiz.previous": "السؤال السابق",
    "quiz.submit": "إرسال",
    "quiz.finish": "إنهاء",
    "quiz.results": "النتائج",
    "quiz.score": "النقاط",
    "quiz.correct": "إجابة صحيحة",
    "quiz.incorrect": "إجابة خاطئة",
    "quiz.timeLeft": "الوقت المتبقي",
    "quiz.timeUp": "انتهى الوقت",
    "quiz.question": "سؤال {current} من {total}",
    "quiz.tryAgain": "حاول مرة أخرى",
    "quiz.share": "مشاركة",
    "quiz.create": "إنشاء اختبار",
    "quiz.edit": "تعديل",
    "quiz.delete": "حذف",
    "quiz.deleteConfirm": "هل أنت متأكد من حذف هذا الاختبار؟",
    "quiz.empty": "لا توجد اختبارات",
    "quiz.emptyDescription": "أنشئ اختبارك الأول",

    # ---- calendar (core) -------------------------------------------------
    "calendar.title": "التقويم",
    "calendar.subtitle": "نظم جلسات الدراسة والامتحانات",
    "calendar.today": "اليوم",
    "calendar.month": "شهر",
    "calendar.week": "أسبوع",
    "calendar.day": "يوم",
    "calendar.event": "حدث",
    "calendar.events": "أحداث",
    "calendar.addEvent": "إضافة حدث",
    "calendar.editEvent": "تعديل الحدث",
    "calendar.deleteEvent": "حذف الحدث",
    "calendar.eventTitle": "عنوان الحدث",
    "calendar.eventDescription": "الوصف",
    "calendar.eventDate": "التاريخ",
    "calendar.eventTime": "الوقت",
    "calendar.startTime": "الوقت الذي يبدأ",
    "calendar.endTime": "الوقت الذي ينتهي",
    "calendar.allDay": "طوال اليوم",
    "calendar.location": "المكان",
    "calendar.empty": "لا توجد أحداث",
    "calendar.noEvents": "لا توجد أحداث مجدولة",
    "calendar.upcoming": "أحداث قادمة",
    "calendar.past": "أحداث ماضية",
    "calendar.eventTypes.exam": "امتحان",
    "calendar.eventTypes.study": "دراسة",
    "calendar.eventTypes.assignment": "واجب",
    "calendar.eventTypes.deadline": "موعد نهائي",
    "calendar.eventTypes.other": "آخر",

    # ---- groups (core) ---------------------------------------------------
    "groups.title": "المجموعات",
    "groups.subtitle": "تعاون مع أصدقائك",
    "groups.create": "إنشاء مجموعة",
    "groups.join": "الانضمام إلى مجموعة",
    "groups.leave": "مغادرة المجموعة",
    "groups.delete": "حذف المجموعة",
    "groups.name": "اسم المجموعة",
    "groups.description": "الوصف",
    "groups.members": "الأعضاء",
    "groups.invite": "دعوة",
    "groups.inviteCode": "رمز الدعوة",
    "groups.empty": "لا توجد مجموعات",
    "groups.emptyDescription": "أنشئ مجموعتك الأولى أو انضم إلى مجموعة موجودة",
    "groups.created": "تم إنشاء المجموعة",
    "groups.joined": "تم الانضمام إلى المجموعة",
    "groups.left": "تمت مغادرة المجموعة",
    "groups.deleted": "تم حذف المجموعة",

    # ---- spark (AI hub) --------------------------------------------------
    "spark.title": "مركز الذكاء الاصطناعي",
    "spark.subtitle": "مساعدك الذكي",
    "spark.ask": "اطرح سؤالًا",
    "spark.askPlaceholder": "كيف يمكنني مساعدتك؟",
    "spark.send": "إرسال",
    "spark.thinking": "يفكر...",
    "spark.error": "حدث خطأ",
    "spark.empty": "ابدأ محادثة",

    # ---- pricing (core) --------------------------------------------------
    "pricing.title": "الأسعار",
    "pricing.subtitle": "اختر الخطة المناسبة لك",
    "pricing.free": "مجاني",
    "pricing.premium": "مميز",
    "pricing.month": "شهر",
    "pricing.year": "سنة",
    "pricing.subscribe": "اشترك",
    "pricing.currentPlan": "الخطة الحالية",
    "pricing.upgrade": "ترقية",
    "pricing.downgrade": "تخفيض",
    "pricing.cancel": "إلغاء الاشتراك",
    "pricing.features": "الميزات",
    "pricing.unlimited": "غير محدود",
    "pricing.limited": "محدود",
    "pricing.popular": "الأكثر شعبية",

    # ---- leaderboard (core) ----------------------------------------------
    "leaderboard.title": "لوحة المتصدرين",
    "leaderboard.subtitle": "تنافس مع المستخدمين الآخرين",
    "leaderboard.rank": "المرتبة",
    "leaderboard.user": "المستخدم",
    "leaderboard.score": "النقاط",
    "leaderboard.xp": "نقاط الخبرة",
    "leaderboard.level": "المستوى",
    "leaderboard.streak": "السلسلة",
    "leaderboard.weekly": "أسبوعي",
    "leaderboard.monthly": "شهري",
    "leaderboard.allTime": "كل الأوقات",
    "leaderboard.global": "عالمي",
    "leaderboard.friends": "الأصدقاء",
    "leaderboard.empty": "لا توجد بيانات",
    "leaderboard.you": "أنت",
    "leaderboard.position": "موقعك",

    # ---- achievements ----------------------------------------------------
    "achievements.title": "الإنجازات",
    "achievements.subtitle": "افتح الشارات",
    "achievements.unlocked": "مفتوح",
    "achievements.locked": "مغلق",
    "achievements.progress": "التقدم",
    "achievements.empty": "لا توجد إنجازات",
    "achievements.viewAll": "عرض الكل",
    "achievements.unlockedAt": "تم الفتح في {date}",

    # ---- duels -----------------------------------------------------------
    "duels.title": "المبارزات",
    "duels.subtitle": "تحدى أصدقاءك",
    "duels.create": "إنشاء مبارزة",
    "duels.join": "الانضمام إلى مبارزة",
    "duels.start": "بدء المبارزة",
    "duels.cancel": "إلغاء",
    "duels.opponent": "الخصم",
    "duels.score": "النقاط",
    "duels.winner": "الفائز",
    "duels.loser": "الخاسر",
    "duels.draw": "تعادل",
    "duels.empty": "لا توجد مبارزات",
    "duels.waiting": "في انتظار خصم...",
    "duels.code": "رمز المبارزة",
    "duels.joinByCode": "انضم برمز",
    "duels.shareCode": "شارك هذا الرمز",

    # ---- focus room ------------------------------------------------------
    "focusRoom.title": "غرف التركيز",
    "focusRoom.subtitle": "ادرس مع آخرين",
    "focusRoom.create": "إنشاء غرفة",
    "focusRoom.join": "الانضمام",
    "focusRoom.leave": "مغادرة",
    "focusRoom.empty": "لا توجد غرف",
    "focusRoom.private": "خاصة",
    "focusRoom.public": "عامة",
    "focusRoom.participants": "المشاركون",
    "focusRoom.start": "بدء",
    "focusRoom.pause": "إيقاف مؤقت",
    "focusRoom.resume": "استئناف",
    "focusRoom.stop": "إيقاف",

    # ---- pomodoro --------------------------------------------------------
    "pomodoro.title": "بومودورو",
    "pomodoro.start": "بدء",
    "pomodoro.pause": "إيقاف مؤقت",
    "pomodoro.resume": "استئناف",
    "pomodoro.reset": "إعادة تعيين",
    "pomodoro.work": "عمل",
    "pomodoro.shortBreak": "استراحة قصيرة",
    "pomodoro.longBreak": "استراحة طويلة",
    "pomodoro.session": "جلسة",
    "pomodoro.sessionsCompleted": "جلسات مكتملة",
    "pomodoro.timeRemaining": "الوقت المتبقي",
    "pomodoro.workDone": "أحسنت! خذ استراحة.",
    "pomodoro.breakDone": "العودة إلى العمل!",

    # ---- ambient sounds --------------------------------------------------
    "ambientSounds.title": "أصوات محيطية",
    "ambientSounds.play": "تشغيل",
    "ambientSounds.pause": "إيقاف",
    "ambientSounds.volume": "مستوى الصوت",

    # ---- explore (core) --------------------------------------------------
    "explore.title": "استكشف",
    "explore.subtitle": "اكتشف المحتوى المشترك",
    "explore.search": "ابحث في المحتوى...",
    "explore.notes": "ملاحظات",
    "explore.flashcards": "بطاقات",
    "explore.quizzes": "اختبارات",
    "explore.subjects": "مواد",
    "explore.popular": "الأكثر شعبية",
    "explore.recent": "الأحدث",
    "explore.rating": "التقييم",
    "explore.author": "الكاتب",
    "explore.duplicate": "نسخ",
    "explore.duplicated": "تم النسخ",
    "explore.empty": "لا توجد نتائج",

    # ---- exam mode -------------------------------------------------------
    "exam_mode.title": "وضع الامتحان",
    "exam_mode.subtitle": "حالة محاكاة للامتحان",
    "exam_mode.start": "بدء الامتحان",
    "exam_mode.cancel": "إلغاء",
    "exam_mode.duration": "المدة",
    "exam_mode.questions": "أسئلة",
    "exam_mode.warning": "تحذير",
    "exam_mode.confirmLeave": "هل أنت متأكد من المغادرة؟ سيُفقد تقدمك.",

    # ---- landing ---------------------------------------------------------
    "landing.title": "Studera - تعلم بذكاء",
    "landing.subtitle": "منصة تعلم تجمع بين الذكاء الاصطناعي والتلعيب",
    "landing.cta": "ابدأ مجانًا",
    "landing.login": "تسجيل الدخول",
    "landing.register": "إنشاء حساب",

    # ---- about (core) ----------------------------------------------------
    "about.title": "عن Studera",
    "about.subtitle": "اكتشف فريقنا ومهمتنا",

    # ---- contact (core) --------------------------------------------------
    "contact.title": "اتصل بنا",
    "contact.subtitle": "هل لديك سؤال؟ نحن هنا للمساعدة",
    "contact.form.name": "الاسم",
    "contact.form.email": "البريد الإلكتروني",
    "contact.form.subject": "الموضوع",
    "contact.form.message": "الرسالة",
    "contact.form.send": "إرسال",
    "contact.form.sending": "جارٍ الإرسال...",
    "contact.form.sent": "تم الإرسال!",
    "contact.form.error": "خطأ في الإرسال",

    # ---- legal (titles) --------------------------------------------------
    "legal.privacy.title": "سياسة الخصوصية",
    "legal.terms.title": "شروط الاستخدام",

    # ---- ai (core) -------------------------------------------------------
    "ai.title": "الذكاء الاصطناعي",
    "ai.subtitle": "مساعدك الذكي",
    "ai.generate": "توليد",
    "ai.generating": "جارٍ التوليد...",
    "ai.error": "خطأ في التوليد",
    "ai.success": "تم التوليد",
    "ai.summarize": "تلخيص",
    "ai.expand": "توسيع",
    "ai.translate": "ترجمة",
    "ai.improve": "تحسين",
    "ai.flashcardsFromNotes": "بطاقات من ملاحظاتك",
    "ai.quizFromNotes": "اختبار من ملاحظاتك",
    "ai.tokens": "رموز",
    "ai.creditsRemaining": "الرصيد المتبقي",
    "ai.upgrade": "ترقية للحصول على المزيد",

    # ---- ocr (core) ------------------------------------------------------
    "ocr.title": "OCR",
    "ocr.subtitle": "استخراج النص من الصور",
    "ocr.upload": "تحميل الصورة",
    "ocr.processing": "جارٍ المعالجة...",
    "ocr.success": "تم الاستخراج بنجاح",
    "ocr.error": "خطأ في المعالجة",
    "ocr.copy": "نسخ النص",
    "ocr.copied": "تم النسخ",

    # ---- activity --------------------------------------------------------
    "activity.title": "النشاط",
    "activity.subtitle": "اطلع على نشاطك الأخير",
    "activity.empty": "لا يوجد نشاط",
    "activity.loadError": "خطأ في تحميل النشاط",
    "activity.today": "اليوم",
    "activity.yesterday": "أمس",
    "activity.thisWeek": "هذا الأسبوع",
    "activity.thisMonth": "هذا الشهر",
    "activity.older": "أقدم",
    "activity.viewAll": "عرض الكل",

    # ---- share -----------------------------------------------------------
    "share.title": "مشاركة",
    "share.copy": "نسخ الرابط",
    "share.copied": "تم النسخ!",
    "share.code": "رمز المشاركة",
    "share.qr": "رمز QR",
    "share.email": "إرسال بالبريد الإلكتروني",

    # ---- quests ----------------------------------------------------------
    "quests.title": "المهام اليومية",
    "quests.subtitle": "أكمل المهام لتربح نقاط الخبرة",
    "quests.daily": "يومي",
    "quests.weekly": "أسبوعي",
    "quests.completed": "مكتمل",
    "quests.pending": "معلق",
    "quests.empty": "لا توجد مهام",
    "quests.reward": "المكافأة",
    "quests.claim": "استلام",
    "quests.claimed": "تم الاستلام",

    # ---- sparkWidget -----------------------------------------------------
    "sparkWidget.title": "Spark AI",
    "sparkWidget.placeholder": "اطرح سؤالًا...",
    "sparkWidget.send": "إرسال",
    "sparkWidget.thinking": "يفكر...",
    "sparkWidget.error": "خطأ",
    "sparkWidget.empty": "ابدأ محادثة",
}


def build_mirror(en_node, path, ar_dict):
    """Walk en.json mirror, substituting AR translations where available."""
    if isinstance(en_node, dict):
        return {k: build_mirror(v, f'{path}.{k}' if path else k, ar_dict) for k, v in en_node.items()}
    if isinstance(en_node, list):
        return [build_mirror(v, f'{path}.{i}', ar_dict) for i, v in enumerate(en_node)]
    if path in ar_dict:
        return ar_dict[path]
    return en_node  # English fallback


def main():
    en = json.load(io.open(os.path.join(MSG_DIR, 'en.json'), encoding='utf-8'))
    ar = build_mirror(en, '', AR_DICT)
    with io.open(os.path.join(MSG_DIR, 'ar.json'), 'w', encoding='utf-8') as f:
        json.dump(ar, f, ensure_ascii=False, indent=2)
        f.write('\n')

    # Stats
    def count_leaves(o):
        if isinstance(o, dict):
            return sum(count_leaves(v) for v in o.values())
        if isinstance(o, list):
            return sum(count_leaves(v) for v in o)
        return 1

    total = count_leaves(en)
    translated = len([k for k in AR_DICT if not k.startswith('$schema')])
    print(f'ar.json written. Total leaves: {total}. Translated: ~{translated}. English fallback: ~{total - translated}.')


if __name__ == '__main__':
    main()
