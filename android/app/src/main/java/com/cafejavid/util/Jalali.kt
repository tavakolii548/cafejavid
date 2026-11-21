package com.cafejavid.util

import java.time.Instant
import java.time.ZoneId

fun todayJalaliTehran(): Triple<Int, Int, Int> {
    val zoned = Instant.now().atZone(ZoneId.of("Asia/Tehran"))
    return toJalaali(zoned.year, zoned.monthValue, zoned.dayOfMonth)
}

fun tehranHourNow(): Int = Instant.now().atZone(ZoneId.of("Asia/Tehran")).hour

/**
 * Same-day window: [start, end). Overnight when start > end.
 * Null bounds = always open. Equal start/end = always open.
 */
fun isWithinServiceHours(startHour: Int?, endHour: Int?, hour: Int = tehranHourNow()): Boolean {
    if (startHour == null || endHour == null) return true
    if (startHour == endHour) return true
    return if (startHour < endHour) hour in startHour until endHour
    else hour >= startHour || hour < endHour
}

fun isOutsideServiceHours(startHour: Int?, endHour: Int?, hour: Int = tehranHourNow()): Boolean =
    !isWithinServiceHours(startHour, endHour, hour)

/** Accepts `yyyy/mm/dd` Jalali; returns month to day. */
fun parseJalaliMonthDay(raw: String?): Pair<Int, Int>? {
    if (raw.isNullOrBlank()) return null
    val parts = toEnglishDigits(raw).split('/').mapNotNull { it.filter(Char::isDigit).toIntOrNull() }
    return when {
        parts.size >= 3 -> parts[1] to parts[2]
        parts.size == 2 -> parts[0] to parts[1]
        else -> null
    }
}

fun isBirthdayToday(birthDate: String?): Boolean {
    val monthDay = parseJalaliMonthDay(birthDate) ?: return false
    val today = todayJalaliTehran()
    return today.second == monthDay.first && today.third == monthDay.second
}

/** Parses `yyyy/mm/dd` Jalali into year, month, day. */
fun parseJalaliDate(raw: String?): Triple<Int, Int, Int>? {
    if (raw.isNullOrBlank()) return null
    val parts = toEnglishDigits(raw).split('/').mapNotNull { it.filter(Char::isDigit).toIntOrNull() }
    if (parts.size < 3) return null
    val y = parts[0]
    val m = parts[1]
    val d = parts[2]
    if (m !in 1..12 || d < 1 || d > jalaliMonthLength(y, m)) return null
    return Triple(y, m, d)
}

fun formatJalaliDate(year: Int, month: Int, day: Int): String =
    "%d/%02d/%02d".format(year, month, day)

fun isLeapJalaliYear(jy: Int): Boolean = jalCal(jy).second == 0

fun jalaliMonthLength(jy: Int, jm: Int): Int = when {
    jm in 1..6 -> 31
    jm in 7..11 -> 30
    jm == 12 -> if (isLeapJalaliYear(jy)) 30 else 29
    else -> 0
}

/** Gregorian to Jalali, ported from jalaali-js (MIT). */
fun toJalaali(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> {
    val jdn = g2d(gy, gm, gd)
    val gy2 = d2g(jdn).first
    var jy = gy2 - 621
    val calendar = jalCal(jy)
    val jdn1f = g2d(gy2, 3, calendar.third)
    var k = jdn - jdn1f
    val jm: Int
    val jd: Int
    if (k >= 0) {
        if (k <= 185) {
            jm = 1 + k / 31
            jd = k % 31 + 1
            return Triple(jy, jm, jd)
        }
        k -= 186
    } else {
        jy -= 1
        k += 179
        if (calendar.second == 1) k += 1
    }
    jm = 7 + k / 30
    jd = k % 30 + 1
    return Triple(jy, jm, jd)
}

fun formatJalaliTehran(iso: String): String {
    val zoned = Instant.parse(iso).atZone(ZoneId.of("Asia/Tehran"))
    val j = toJalaali(zoned.year, zoned.monthValue, zoned.dayOfMonth)
    val text = "%d/%02d/%02d %02d:%02d".format(j.first, j.second, j.third, zoned.hour, zoned.minute)
    return toPersianDigits(text)
}

private fun g2d(gy: Int, gm: Int, gd: Int): Int {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
    return d
}

private fun d2g(jdn: Int): Triple<Int, Int, Int> {
    var j = 4 * jdn + 139361631
    j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
    val i = div(mod(j, 1461), 4) * 5 + 308
    val gd = div(mod(i, 153), 5) + 1
    val gm = mod(div(i, 153), 12) + 1
    val gy = div(j, 1461) - 100100 + div(8 - gm, 6)
    return Triple(gy, gm, gd)
}

private fun jalCal(jy: Int): Triple<Int, Int, Int> {
    val breaks = intArrayOf(-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178)
    val gy = jy + 621
    var leapJ = -14
    var jp = breaks[0]
    var jump = 0
    for (i in 1 until breaks.size) {
        val jm = breaks[i]
        jump = jm - jp
        if (jy < jm) break
        leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
        jp = jm
    }
    var n = jy - jp
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
    if (mod(jump, 33) == 4 && jump - n == 4) leapJ += 1
    val leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
    val march = 20 + leapJ - leapG
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
    var leap = mod(mod(n + 1, 33) - 1, 4)
    if (leap == -1) leap = 4
    return Triple(gy, leap, march)
}

private fun div(a: Int, b: Int) = Math.floorDiv(a, b)
private fun mod(a: Int, b: Int) = Math.floorMod(a, b)
