package com.cafejavid.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.sessionStore by preferencesDataStore("session")
private val Context.cartStore by preferencesDataStore("cart")
private val Context.notificationStore by preferencesDataStore("notifications")
private val Context.welcomeStore by preferencesDataStore("welcome")

@kotlinx.serialization.Serializable
data class AppNotification(
    val id: String,
    val title: String,
    val body: String,
    val createdAt: Long = System.currentTimeMillis(),
    val read: Boolean = false,
    /** "server" = panel/inbox campaign; "local" = in-app events */
    val source: String = "local",
)

data class Session(
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val phone: String? = null,
    val name: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val birthDate: String? = null,
    val customerCode: String? = null,
    val guest: Boolean = false,
)

@Singleton
class SessionStore @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.sessionStore
    private val access = stringPreferencesKey("access")
    private val refresh = stringPreferencesKey("refresh")
    private val phone = stringPreferencesKey("phone")
    private val name = stringPreferencesKey("name")
    private val firstName = stringPreferencesKey("first_name")
    private val lastName = stringPreferencesKey("last_name")
    private val birthDate = stringPreferencesKey("birth_date")
    private val customerCode = stringPreferencesKey("customer_code")
    private val guest = booleanPreferencesKey("guest")

    val session: Flow<Session> = store.data.map { prefs ->
        Session(
            accessToken = prefs[access],
            refreshToken = prefs[refresh],
            phone = prefs[phone],
            name = prefs[name],
            firstName = prefs[firstName],
            lastName = prefs[lastName],
            birthDate = prefs[birthDate],
            customerCode = prefs[customerCode],
            guest = prefs[guest] ?: false,
        )
    }

    suspend fun saveAuth(response: AuthResponse) {
        store.edit { prefs ->
            prefs[access] = response.accessToken
            prefs[refresh] = response.refreshToken
            prefs[phone] = response.user.phone
            response.user.name?.let { prefs[name] = it } ?: prefs.remove(name)
            response.user.firstName?.let { prefs[firstName] = it } ?: prefs.remove(firstName)
            response.user.lastName?.let { prefs[lastName] = it } ?: prefs.remove(lastName)
            response.user.birthDate?.takeIf { it.isNotBlank() }?.let { prefs[birthDate] = it }
                ?: prefs.remove(birthDate)
            response.user.customerCode?.takeIf { it.isNotBlank() }?.let { prefs[customerCode] = it }
                ?: prefs.remove(customerCode)
            prefs[guest] = false
        }
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        store.edit { prefs ->
            prefs[access] = accessToken
            prefs[refresh] = refreshToken
        }
    }

    suspend fun saveName(value: String) {
        store.edit { it[name] = value }
    }

    suspend fun saveProfile(
        name: String?,
        firstName: String?,
        lastName: String?,
        birthDate: String?,
        customerCode: String?,
    ) {
        store.edit { prefs ->
            name?.takeIf { it.isNotBlank() }?.let { prefs[this.name] = it } ?: prefs.remove(this.name)
            firstName?.takeIf { it.isNotBlank() }?.let { prefs[this.firstName] = it } ?: prefs.remove(this.firstName)
            lastName?.takeIf { it.isNotBlank() }?.let { prefs[this.lastName] = it } ?: prefs.remove(this.lastName)
            birthDate?.takeIf { it.isNotBlank() }?.let { prefs[this.birthDate] = it } ?: prefs.remove(this.birthDate)
            customerCode?.takeIf { it.isNotBlank() }?.let { prefs[this.customerCode] = it }
                ?: prefs.remove(this.customerCode)
        }
    }

    suspend fun setGuest() {
        store.edit { it[guest] = true }
    }

    suspend fun clear() {
        store.edit { it.clear() }
    }
}

@Singleton
class CartStore @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.cartStore
    private val linesKey = stringPreferencesKey("lines")
    private val favKey = stringSetPreferencesKey("favorites")
    private val json = Json { ignoreUnknownKeys = true }

    val lines: Flow<List<CartLine>> = store.data.map { prefs ->
        prefs[linesKey]?.let { raw ->
            runCatching { json.decodeFromString<List<CartLine>>(raw) }.getOrDefault(emptyList())
        } ?: emptyList()
    }

    val favorites: Flow<Set<String>> = store.data.map { it[favKey] ?: emptySet() }

    suspend fun setLines(lines: List<CartLine>) {
        store.edit { it[linesKey] = json.encodeToString(lines) }
    }

    suspend fun update(block: (List<CartLine>) -> List<CartLine>) {
        store.edit { prefs ->
            val current = prefs[linesKey]?.let { raw ->
                runCatching { json.decodeFromString<List<CartLine>>(raw) }.getOrDefault(emptyList())
            } ?: emptyList()
            prefs[linesKey] = json.encodeToString(block(current))
        }
    }

    suspend fun toggleFavorite(productId: String) {
        store.edit { prefs ->
            val current = prefs[favKey]?.toMutableSet() ?: mutableSetOf()
            if (!current.add(productId)) current.remove(productId)
            prefs[favKey] = current
        }
    }
}

@Singleton
class CheckoutGate @Inject constructor() {
    @Volatile var pending: Boolean = false
}

@Singleton
class WelcomeGate @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.welcomeStore
    private val usedKey = stringSetPreferencesKey("used_indices")
    private val dayKey = stringPreferencesKey("day_key")
    private val dayMessageKey = stringPreferencesKey("day_message")

    @Volatile
    private var pendingMessage: String? = null

    @Volatile
    private var pendingName: String? = null

    suspend fun prepareMessage(displayName: String? = null) {
        val today = com.cafejavid.util.todayJalaliTehran()
        val day = "${today.first}-${today.second}-${today.third}"
        var chosen: String? = null
        store.edit { prefs ->
            val existingDay = prefs[dayKey]
            val existingMessage = prefs[dayMessageKey]
            if (existingDay == day && !existingMessage.isNullOrBlank()) {
                chosen = existingMessage
                return@edit
            }
            val used = prefs[usedKey]?.toMutableSet() ?: mutableSetOf()
            val available = CafeWelcomeMessages.indices.map { it.toString() }.filterNot { it in used }
            val pool = if (available.isEmpty()) {
                used.clear()
                CafeWelcomeMessages.indices.map { it.toString() }
            } else {
                available
            }
            val index = pool.random().toInt()
            chosen = CafeWelcomeMessages[index]
            used += index.toString()
            prefs[usedKey] = used
            prefs[dayKey] = day
            prefs[dayMessageKey] = chosen
        }
        pendingMessage = chosen
        pendingName = displayName
    }

    fun consume(): WelcomeContent? {
        val message = pendingMessage ?: return null
        pendingMessage = null
        val name = pendingName
        pendingName = null
        return personalizeWelcome(message, name)
    }
}

@Singleton
class NotificationStore @Inject constructor(
    @ApplicationContext context: Context,
    private val systemNotifier: com.cafejavid.notifications.SystemNotifier,
) {
    private val store = context.notificationStore
    private val itemsKey = stringPreferencesKey("items")
    private val birthdayYearKey = stringPreferencesKey("birthday_year")
    private val json = Json { ignoreUnknownKeys = true }

    val notifications: Flow<List<AppNotification>> = store.data.map { prefs ->
        prefs[itemsKey]?.let { raw ->
            runCatching { json.decodeFromString<List<AppNotification>>(raw) }.getOrDefault(emptyList())
        } ?: emptyList()
    }

    val unreadCount: Flow<Int> = notifications.map { list -> list.count { !it.read } }

    suspend fun push(title: String, body: String) {
        val id = java.util.UUID.randomUUID().toString()
        store.edit { prefs ->
            val current = prefs[itemsKey]?.let { raw ->
                runCatching { json.decodeFromString<List<AppNotification>>(raw) }.getOrDefault(emptyList())
            } ?: emptyList()
            val next = listOf(
                AppNotification(
                    id = id,
                    title = title,
                    body = body,
                    source = "local",
                ),
            ) + current
            prefs[itemsKey] = json.encodeToString(next.take(100))
        }
        systemNotifier.notify(id, title, body)
    }

    suspend fun maybePushBirthday(birthDate: String?, displayName: String?) {
        if (!com.cafejavid.util.isBirthdayToday(birthDate)) return
        val year = com.cafejavid.util.todayJalaliTehran().first.toString()
        var shouldPush = false
        store.edit { prefs ->
            if (prefs[birthdayYearKey] == year) return@edit
            prefs[birthdayYearKey] = year
            shouldPush = true
        }
        if (!shouldPush) return
        val who = displayName?.takeIf { it.isNotBlank() }
        val body = if (who != null) {
            "$who عزیز، تولدت مبارک! یه فنجون قهوه از طرف کافه جاوید نثار این روز قشنگت."
        } else {
            "تولدت مبارک! یه فنجون قهوه از طرف کافه جاوید نثار این روز قشنگت."
        }
        push(title = "تولدت مبارک", body = body)
    }

    suspend fun markAllRead() {
        store.edit { prefs ->
            val current = prefs[itemsKey]?.let { raw ->
                runCatching { json.decodeFromString<List<AppNotification>>(raw) }.getOrDefault(emptyList())
            } ?: emptyList()
            prefs[itemsKey] = json.encodeToString(current.map { it.copy(read = true) })
        }
    }

    suspend fun clearAll() {
        store.edit { prefs ->
            prefs[itemsKey] = json.encodeToString(emptyList<AppNotification>())
        }
    }

    suspend fun mergeServer(items: List<ServerNotificationDto>) {
        if (items.isEmpty()) return
        val newlyUnread = mutableListOf<AppNotification>()
        store.edit { prefs ->
            val current = prefs[itemsKey]?.let { raw ->
                runCatching { json.decodeFromString<List<AppNotification>>(raw) }.getOrDefault(emptyList())
            } ?: emptyList()
            val byId = current.associateBy { it.id }.toMutableMap()
            for (item in items) {
                val createdAt = runCatching {
                    java.time.Instant.parse(item.createdAt).toEpochMilli()
                }.getOrDefault(System.currentTimeMillis())
                val existing = byId[item.id]
                val read = existing?.read == true || item.read
                val merged = AppNotification(
                    id = item.id,
                    title = item.title,
                    body = item.body,
                    createdAt = createdAt,
                    read = read,
                    source = "server",
                )
                if (existing == null && !read) {
                    newlyUnread += merged
                } else if (existing != null && existing.source != "server") {
                    // Upgrade local-looking duplicate id to server source when inbox owns it.
                    byId[item.id] = merged
                }
                byId[item.id] = merged
            }
            prefs[itemsKey] = json.encodeToString(
                byId.values.sortedByDescending { it.createdAt }.take(100),
            )
        }
        for (item in newlyUnread) {
            systemNotifier.notify(item.id, item.title, item.body)
        }
    }
}
