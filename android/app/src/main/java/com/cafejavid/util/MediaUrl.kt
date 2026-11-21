package com.cafejavid.util

import com.cafejavid.BuildConfig

/**
 * Turns relative media paths (e.g. `/uploads/...`) into absolute URLs for Coil.
 * Absolute http(s) URLs are returned unchanged.
 */
fun resolveMediaUrl(url: String?): String? {
    val trimmed = url?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    if (trimmed.startsWith("http://", ignoreCase = true) ||
        trimmed.startsWith("https://", ignoreCase = true) ||
        trimmed.startsWith("data:", ignoreCase = true)
    ) {
        return trimmed
    }
    val base = BuildConfig.API_BASE.trimEnd('/')
    val path = if (trimmed.startsWith('/')) trimmed else "/$trimmed"
    return "$base$path"
}
