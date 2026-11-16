package com.cafejavid.util

import java.util.Locale

private const val PERSIAN = "۰۱۲۳۴۵۶۷۸۹"
private const val ARABIC = "٠١٢٣٤٥٦٧٨٩"

fun toEnglishDigits(input: String): String = buildString(input.length) {
    for (ch in input) {
        val p = PERSIAN.indexOf(ch)
        val a = ARABIC.indexOf(ch)
        append(when {
            p >= 0 -> '0' + p
            a >= 0 -> '0' + a
            else -> ch
        })
    }
}

fun toPersianDigits(input: String): String = input.map { ch ->
    if (ch in '0'..'9') PERSIAN[ch - '0'] else ch
}.joinToString("")

fun toPersianDigits(input: Int): String = toPersianDigits(input.toString())

fun formatPrice(amount: Int): String {
    val grouped = "%,d".format(Locale.US, amount).replace(',', '٬')
    return "${toPersianDigits(grouped)} تومان"
}

fun normalizePhone(input: String): String? {
    val digits = toEnglishDigits(input).filter { it.isDigit() }
    val local = when {
        digits.startsWith("0098") -> "0" + digits.drop(4)
        digits.startsWith("98") && digits.length == 12 -> "0" + digits.drop(2)
        digits.startsWith("9") && digits.length == 10 -> "0$digits"
        else -> digits
    }
    return local.takeIf { it.matches(Regex("^09\\d{9}$")) }
}
