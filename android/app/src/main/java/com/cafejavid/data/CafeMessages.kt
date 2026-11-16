package com.cafejavid.data

data class WelcomeContent(
    val title: String,
    val body: String,
    val firstName: String? = null,
)

val CafeWelcomeMessages = listOf(
    "یه فنجون قهوه، یه حالِ آروم برای ادامه روز.",
    "بوی تازه برشتگی، مثل یه سلام گرم از کافه جاوید.",
    "امروز رو با یه جرعه آرامش شروع کن.",
    "اینجا هر فنجون، بهونه‌ایه برای لبخند.",
    "بین شلوغی شهر، یه گوشه دنج برای خودت.",
    "قهوه خوب، روز خوب می‌سازه.",
    "یه مکث کوتاه، یه فنجون گرم، دوباره انرژی.",
    "بذار امروز هم مثل قهوه‌ت، غلیظ و دلچسب باشه.",
    "هر جرعه، یادآوری کوچیک برای مراقبت از خودته.",
    "کافه جاوید؛ جایی برای نفس کشیدن و دوباره شروع کردن.",
    "تلخی قهوه گاهی شیرین‌ترین بخش روزه.",
    "با یه سفارش ساده، یه حال تازه به خودت هدیه بده.",
    "عطر قهوه تو هواست؛ بذار لبخند هم بیاد سراغت.",
    "روزای شلوغ، با یه فنجون آروم‌تر می‌شن.",
    "اینجا فقط نوشیدنی نیست؛ یه حال خوبه.",
    "برای خودت وقت بذار؛ حتی به اندازه یه اسپرسو.",
    "از صبح تا شب، یه جرعه انرژی منتظرته.",
    "بوی قهوه، قول یه روز بهتره.",
    "آروم بنشین، سفارش بده، لحظه‌تو بساز.",
    "کافه جاوید کنارته؛ امروز هم نوش جان.",
)

fun displayFirstName(raw: String?): String? =
    raw?.trim()
        ?.takeIf { it.isNotBlank() }
        ?.split(Regex("\\s+"))
        ?.firstOrNull()
        ?.takeIf { it.isNotBlank() }

fun personalizeWelcome(message: String, displayName: String?): WelcomeContent {
    val first = displayFirstName(displayName)
    return if (first != null) {
        WelcomeContent(
            title = "سلام، $first",
            body = "$first عزیز؛ $message",
            firstName = first,
        )
    } else {
        WelcomeContent(
            title = "خوش اومدی",
            body = message,
            firstName = null,
        )
    }
}
