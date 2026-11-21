package com.cafejavid.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewModelScope
import com.cafejavid.R
import com.cafejavid.data.AppNotification
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.SessionStore
import com.cafejavid.ui.common.CafeEmptyState
import com.cafejavid.ui.common.SoftCardShape
import com.cafejavid.ui.common.cafeScreenEnter
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.util.formatJalaliTehran
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val store: NotificationStore,
    private val api: com.cafejavid.data.CafeApi,
    private val session: SessionStore,
) : ViewModel() {
    val items = store.notifications

    init {
        refreshFromServer()
    }

    fun refreshFromServer() {
        viewModelScope.launch {
            val token = session.session.first().accessToken
            if (token.isNullOrBlank()) return@launch
            runCatching { api.myNotifications() }
                .onSuccess { store.mergeServer(it) }
        }
    }

    fun markRead() {
        viewModelScope.launch {
            store.markAllRead()
            val token = session.session.first().accessToken
            if (!token.isNullOrBlank()) {
                runCatching { api.markNotificationsRead() }
            }
        }
    }
}

@Composable
fun NotificationsScreen(onBack: () -> Unit, vm: NotificationsViewModel = hiltViewModel()) {
    val items by vm.items.collectAsState(emptyList())
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(Unit) { vm.markRead() }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) vm.refreshFromServer()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val cafeItems = items.filter { it.source == "server" }
    val appItems = items.filter { it.source != "server" }
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(
            Modifier
                .fillMaxWidth()
                .cafeScreenEnter()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.size(44.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.back), tint = Ink)
            }
            Text(stringResource(R.string.notifications), style = MaterialTheme.typography.headlineSmall)
        }
        if (items.isEmpty()) {
            CafeEmptyState(
                icon = Icons.Outlined.NotificationsNone,
                title = stringResource(R.string.empty_notifications_title),
                hint = stringResource(R.string.empty_notifications_hint),
                modifier = Modifier.weight(1f),
            )
            return@Column
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (cafeItems.isNotEmpty()) {
                Text(
                    stringResource(R.string.notif_from_cafe),
                    style = MaterialTheme.typography.titleMedium,
                    color = Ink,
                    modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
                )
                cafeItems.forEach { item -> NotificationCard(item) }
            }
            if (appItems.isNotEmpty()) {
                Text(
                    stringResource(R.string.notif_from_app),
                    style = MaterialTheme.typography.titleMedium,
                    color = Ink,
                    modifier = Modifier.padding(top = if (cafeItems.isNotEmpty()) 12.dp else 4.dp, bottom = 2.dp),
                )
                appItems.forEach { item -> NotificationCard(item) }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun NotificationCard(item: AppNotification) {
    val time = runCatching {
        formatJalaliTehran(Instant.ofEpochMilli(item.createdAt).toString())
    }.getOrDefault("")
    Row(
        Modifier
            .fillMaxWidth()
            .shadow(
                6.dp,
                SoftCardShape,
                ambientColor = PrimaryGreen.copy(alpha = 0.05f),
                spotColor = PrimaryGreen.copy(alpha = 0.08f),
            )
            .clip(SoftCardShape)
            .background(if (!item.read) PrimaryTint.copy(alpha = 0.55f) else Color.White)
            .border(1.dp, Border, SoftCardShape)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!item.read) {
            Box(
                Modifier
                    .padding(top = 6.dp)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(PrimaryGreen),
            )
        } else {
            Box(
                Modifier
                    .padding(top = 4.dp)
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PrimaryTint),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.NotificationsNone,
                    contentDescription = null,
                    tint = PrimaryGreen,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(item.title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(item.body, style = MaterialTheme.typography.bodyMedium, color = Muted)
            if (time.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(time, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }
    }
}
