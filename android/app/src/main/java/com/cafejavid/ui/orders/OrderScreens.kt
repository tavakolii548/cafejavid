package com.cafejavid.ui.orders

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cafejavid.BuildConfig
import com.cafejavid.R
import com.cafejavid.data.AddressDto
import com.cafejavid.data.CafeApi
import com.cafejavid.data.CafeConfig
import com.cafejavid.data.CancelBody
import com.cafejavid.data.CartLine
import com.cafejavid.data.CartStore
import com.cafejavid.data.NameBody
import com.cafejavid.data.OrderDto
import com.cafejavid.data.ReorderPreview
import com.cafejavid.data.Session
import com.cafejavid.data.SessionStore
import com.cafejavid.data.UnavailableItem
import com.cafejavid.data.UserDto
import com.cafejavid.di.apiMessage
import com.cafejavid.ui.common.CafeEmptyState
import com.cafejavid.ui.common.CafeStatusChip
import com.cafejavid.ui.common.JalaliBirthDateDialog
import com.cafejavid.ui.common.PulseDot
import com.cafejavid.ui.common.SoftCardShape
import com.cafejavid.ui.common.cafeScreenEnter
import com.cafejavid.ui.theme.Accent
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.CafeButton
import com.cafejavid.ui.theme.CafeOutlinedButton
import com.cafejavid.ui.theme.Danger
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.ui.theme.RadiusMd
import com.cafejavid.util.formatJalaliTehran
import com.cafejavid.util.formatPrice
import com.cafejavid.util.toPersianDigits
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.UUID
import javax.inject.Inject

private fun customerCanCancel(status: String): Boolean = status == "NEW"

@HiltViewModel
class OrdersViewModel @Inject constructor(
    private val api: CafeApi,
    private val session: SessionStore,
    private val cart: CartStore,
) : ViewModel() {
    private val _orders = MutableStateFlow<List<OrderDto>>(emptyList())
    val orders = _orders.asStateFlow()
    private val _error = MutableStateFlow(false)
    val error = _error.asStateFlow()
    private val _reorderPreview = MutableStateFlow<ReorderPreview?>(null)
    val reorderPreview = _reorderPreview.asStateFlow()
    private var pendingReorderDone: (() -> Unit)? = null
    val sessionFlow = session.session

    fun load() {
        viewModelScope.launch {
            if (session.session.first().accessToken.isNullOrBlank()) {
                _orders.value = emptyList()
                return@launch
            }
            runCatching { api.myOrders() }
                .onSuccess { _orders.value = it; _error.value = false }
                .onFailure { _error.value = true }
        }
    }

    fun reorder(id: String, onDone: () -> Unit) {
        viewModelScope.launch {
            runCatching { api.reorder(id) }.onSuccess { preview ->
                if (preview.unavailable.isEmpty()) {
                    applyReorder(preview, onDone)
                } else {
                    pendingReorderDone = onDone
                    _reorderPreview.value = preview
                }
            }
        }
    }

    fun dismissReorderPreview() {
        pendingReorderDone = null
        _reorderPreview.value = null
    }

    fun confirmReorder() {
        val preview = _reorderPreview.value ?: return
        val done = pendingReorderDone
        pendingReorderDone = null
        _reorderPreview.value = null
        applyReorder(preview) { done?.invoke() }
    }

    private fun applyReorder(preview: ReorderPreview, onDone: () -> Unit) {
        viewModelScope.launch {
            if (preview.items.isNotEmpty()) {
                cart.setLines(preview.items.map { item ->
                    CartLine(
                        UUID.randomUUID().toString(),
                        item.productId,
                        item.name,
                        item.quantity,
                        item.choiceIds,
                        item.optionSummary,
                        item.unitPrice,
                        item.note,
                    )
                })
            }
            onDone()
        }
    }
}

@Composable
fun OrdersScreen(onOpen: (String) -> Unit, onLogin: () -> Unit, onReorder: () -> Unit, vm: OrdersViewModel = hiltViewModel()) {
    val orders by vm.orders.collectAsState()
    val error by vm.error.collectAsState()
    val session by vm.sessionFlow.collectAsState(Session())
    val reorderPreview by vm.reorderPreview.collectAsState()
    LaunchedEffect(Unit) { vm.load() }
    reorderPreview?.let { preview ->
        ReorderUnavailableDialog(
            unavailable = preview.unavailable,
            hasItems = preview.items.isNotEmpty(),
            onDismiss = vm::dismissReorderPreview,
            onContinue = { vm.confirmReorder() },
        )
    }
    Column(
        Modifier
            .fillMaxSize()
            .background(Background)
            .cafeScreenEnter()
            .padding(20.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Text(stringResource(R.string.tab_orders), style = MaterialTheme.typography.headlineSmall)
        if (session.accessToken.isNullOrBlank()) {
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.login_required), color = Muted)
            CafeButton(stringResource(R.string.login_title), onLogin, Modifier.padding(top = 12.dp).height(52.dp))
            return@Column
        }
        if (error) CafeButton(stringResource(R.string.retry), vm::load, Modifier.padding(top = 12.dp).height(52.dp))
        if (orders.isEmpty() && !error) {
            CafeEmptyState(
                icon = Icons.Outlined.ReceiptLong,
                title = stringResource(R.string.empty_orders),
            )
        }
        orders.forEach { order ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .shadow(
                        8.dp,
                        SoftCardShape,
                        ambientColor = PrimaryGreen.copy(alpha = 0.06f),
                        spotColor = PrimaryGreen.copy(alpha = 0.1f),
                    )
                    .clip(SoftCardShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftCardShape)
                    .clickable { onOpen(order.id) }
                    .padding(16.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.order_number, toPersianDigits(order.number)),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    CafeStatusChip(statusLabel(order.status, order.fulfillment))
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    runCatching { formatJalaliTehran(order.createdAt) }.getOrDefault(""),
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted,
                )
                Spacer(Modifier.height(4.dp))
                Text(formatPrice(order.total), style = MaterialTheme.typography.titleMedium, color = PrimaryGreen)
                Text(
                    stringResource(R.string.reorder),
                    color = PrimaryGreen,
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier
                        .padding(top = 10.dp)
                        .clickable { vm.reorder(order.id, onReorder) },
                )
            }
        }
    }
}

@Composable
private fun ReorderUnavailableDialog(
    unavailable: List<UnavailableItem>,
    hasItems: Boolean,
    onDismiss: () -> Unit,
    onContinue: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.reorder_unavailable_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                unavailable.forEach { item ->
                    Text(
                        "• ${item.productName} — ${item.reason.ifBlank { stringResource(R.string.sold_out) }}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Ink,
                    )
                }
                if (!hasItems) {
                    Spacer(Modifier.height(4.dp))
                    Text(stringResource(R.string.reorder_unavailable_empty), color = Muted)
                }
            }
        },
        confirmButton = {
            if (hasItems) {
                TextButton(onClick = onContinue) {
                    Text(stringResource(R.string.reorder_unavailable_continue))
                }
            } else {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(R.string.close))
                }
            }
        },
        dismissButton = {
            if (hasItems) {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(R.string.cancel))
                }
            }
        },
    )
}

@HiltViewModel
class TrackingViewModel @Inject constructor(
    private val api: CafeApi,
    private val session: SessionStore,
    private val client: OkHttpClient,
    private val notifications: com.cafejavid.data.NotificationStore,
    @dagger.hilt.android.qualifiers.ApplicationContext private val context: android.content.Context,
) : ViewModel() {
    private val _order = MutableStateFlow<OrderDto?>(null)
    val order = _order.asStateFlow()
    private val _config = MutableStateFlow(CafeConfig())
    val config = _config.asStateFlow()
    private val _error = MutableStateFlow(false)
    val error = _error.asStateFlow()
    private val _cancelling = MutableStateFlow(false)
    val cancelling = _cancelling.asStateFlow()
    private val _cancelError = MutableStateFlow<String?>(null)
    val cancelError = _cancelError.asStateFlow()
    private var lastKnownStatus: String? = null

    fun start(id: String) {
        viewModelScope.launch {
            runCatching { api.config() }.onSuccess { _config.value = it }
            refresh(id)
            if (!BuildConfig.DEMO_MODE) launch { stream(id) }
            while (isActive) {
                delay(if (BuildConfig.DEMO_MODE) 3_000 else 10_000)
                refresh(id)
            }
        }
    }

    private suspend fun refresh(id: String) {
        runCatching { api.order(id) }
            .onSuccess { order ->
                applyOrderUpdate(order)
                _error.value = false
            }
            .onFailure { _error.value = true }
    }

    private suspend fun stream(id: String) {
        val token = session.session.first().accessToken ?: return
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("${BuildConfig.API_BASE}api/v1/orders/$id/stream?token=$token")
                .build()
            runCatching {
                client.newCall(request).execute().use { response ->
                    val source = response.body?.source() ?: return@use
                    while (isActive) {
                        val line = source.readUtf8Line() ?: break
                        if (!line.startsWith("data:")) continue
                        val json = JSONObject(line.removePrefix("data:").trim())
                        val current = _order.value ?: continue
                        val updated = current.copy(
                            status = json.optString("status", current.status),
                            cancelReason = json.optString("cancelReason").ifBlank { current.cancelReason },
                            estimatedMinutes = if (json.has("estimatedMinutes") && !json.isNull("estimatedMinutes")) json.optInt("estimatedMinutes") else current.estimatedMinutes,
                        )
                        applyOrderUpdate(updated)
                        _error.value = false
                    }
                }
            }
        }
    }

    private suspend fun applyOrderUpdate(order: OrderDto) {
        val previous = lastKnownStatus
        _order.value = order
        lastKnownStatus = order.status
        if (previous == null || previous == order.status) return
        // Prefer server inbox rows (stable ids) so mergeServer can post OS alerts without duplicates.
        val merged = runCatching { api.myNotifications() }
            .onSuccess { notifications.mergeServer(it) }
            .isSuccess
        if (!merged) {
            notifications.push(
                context.getString(R.string.notif_order_status_title),
                statusLabelText(order.status, order.fulfillment, order.number),
            )
        }
    }

    fun cancel(reason: String?, onDone: () -> Unit = {}) {
        val id = _order.value?.id ?: return
        viewModelScope.launch {
            _cancelling.value = true
            _cancelError.value = null
            runCatching { api.cancel(id, CancelBody(reason?.trim()?.ifBlank { null })) }
                .onSuccess {
                    applyOrderUpdate(it)
                    onDone()
                }
                .onFailure { _cancelError.value = it.apiMessage() ?: context.getString(R.string.error_network) }
            _cancelling.value = false
        }
    }

    private fun statusLabelText(status: String, fulfillment: String, number: Int): String {
        val statusText = when (status) {
            "NEW" -> context.getString(R.string.status_new)
            "PREPARING" -> context.getString(R.string.status_preparing)
            "READY" -> context.getString(
                if (fulfillment == "DELIVERY") R.string.status_ready_delivery else R.string.status_ready_pickup,
            )
            "OUT_FOR_DELIVERY" -> context.getString(R.string.status_out)
            "DELIVERED" -> context.getString(R.string.status_delivered)
            "CANCELLED" -> context.getString(R.string.cancelled)
            else -> status
        }
        return context.getString(R.string.order_number, com.cafejavid.util.toPersianDigits(number)) + " — " + statusText
    }
}

@Composable
fun TrackingScreen(orderId: String, onMenu: () -> Unit, vm: TrackingViewModel = hiltViewModel()) {
    val order by vm.order.collectAsState()
    val config by vm.config.collectAsState()
    val error by vm.error.collectAsState()
    val cancelling by vm.cancelling.collectAsState()
    val cancelError by vm.cancelError.collectAsState()
    val context = LocalContext.current
    var showCancelDialog by remember { mutableStateOf(false) }
    var cancelReason by remember { mutableStateOf("") }
    LaunchedEffect(orderId) { vm.start(orderId) }
    val current = order
    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { if (!cancelling) showCancelDialog = false },
            title = { Text(stringResource(R.string.cancel_order_confirm)) },
            text = {
                Column {
                    OutlinedTextField(
                        value = cancelReason,
                        onValueChange = { cancelReason = it.take(140) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(stringResource(R.string.cancel_reason_hint), color = Muted) },
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = Border,
                            unfocusedBorderColor = Border,
                            cursorColor = PrimaryGreen,
                            focusedTextColor = Ink,
                            unfocusedTextColor = Ink,
                        ),
                    )
                    cancelError?.let {
                        Text(it, color = Danger, modifier = Modifier.padding(top = 8.dp))
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.cancel(cancelReason) {
                            showCancelDialog = false
                            cancelReason = ""
                        }
                    },
                    enabled = !cancelling,
                ) {
                    Text(
                        if (cancelling) stringResource(R.string.cancelling_order)
                        else stringResource(R.string.cancel_order_action),
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }, enabled = !cancelling) {
                    Text(stringResource(R.string.keep_order))
                }
            },
        )
    }
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.cafeScreenEnter().padding(8.dp),
        ) {
            IconButton(onClick = onMenu, modifier = Modifier.size(44.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.back), tint = Ink)
            }
            Text(stringResource(R.string.tracking_title), style = MaterialTheme.typography.headlineSmall)
        }
        if (error && current == null) {
            CafeButton(stringResource(R.string.retry), { vm.start(orderId) }, Modifier.padding(20.dp).height(52.dp))
            return@Column
        }
        if (current == null) {
            Text(stringResource(R.string.loading), modifier = Modifier.padding(20.dp), color = Muted)
            return@Column
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            if (current.status == "CANCELLED") {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(SoftCardShape)
                        .background(PrimaryTint)
                        .padding(18.dp),
                ) {
                    Text(stringResource(R.string.cancelled), style = MaterialTheme.typography.titleLarge)
                    current.cancelReason?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(it, color = Muted, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            } else {
                val statusText = statusLabel(current.status, current.fulfillment)
                Column(
                    Modifier
                        .fillMaxWidth()
                        .shadow(
                            14.dp,
                            RoundedCornerShape(24.dp),
                            ambientColor = PrimaryGreen.copy(alpha = 0.2f),
                            spotColor = PrimaryGreen.copy(alpha = 0.28f),
                        )
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFF163A2C), PrimaryGreen, Color(0xFF2A6B4F)),
                            ),
                        )
                        .padding(20.dp),
                ) {
                    Text(
                        stringResource(R.string.order_number, toPersianDigits(current.number)),
                        color = Color.White.copy(alpha = 0.82f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PulseDot(color = Accent, size = 10.dp)
                        Spacer(Modifier.size(10.dp))
                        Text(statusText, color = Color.White, style = MaterialTheme.typography.headlineSmall)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.eta, toPersianDigits(current.estimatedMinutes ?: 25)),
                        color = Accent,
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                Spacer(Modifier.height(16.dp))
                Timeline(current.fulfillment, current.status)
            }
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(SoftCardShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftCardShape)
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f).padding(end = 12.dp)) {
                    Text(
                        stringResource(R.string.items_count, toPersianDigits(current.items.sumOf { it.quantity })),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        current.items.joinToString("، ") { it.productName },
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted,
                    )
                }
                Text(formatPrice(current.total), style = MaterialTheme.typography.titleMedium, color = PrimaryGreen)
            }
            if (customerCanCancel(current.status)) {
                Spacer(Modifier.height(16.dp))
                CafeOutlinedButton(
                    if (cancelling) stringResource(R.string.cancelling_order) else stringResource(R.string.cancel_order),
                    { showCancelDialog = true },
                    Modifier.fillMaxWidth().height(48.dp),
                    enabled = !cancelling,
                )
                cancelError?.let {
                    Text(it, color = Danger, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
        Column(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .border(1.dp, Border)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CafeOutlinedButton(stringResource(R.string.call_cafe), {
                    val phone = config.phone
                    if (phone.isNotBlank()) {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                    }
                }, Modifier.weight(1f).height(54.dp))
                if (config.courierPhone.isNotBlank()) {
                    CafeOutlinedButton(stringResource(R.string.call_courier), {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${config.courierPhone}")))
                    }, Modifier.weight(1f).height(54.dp))
                }
            }
            CafeButton(stringResource(R.string.back_to_menu), onMenu, Modifier.fillMaxWidth().height(54.dp))
        }
    }
}

@Composable
private fun Timeline(fulfillment: String, status: String) {
    val steps = if (fulfillment == "DELIVERY") {
        stringArray(R.array.steps_delivery)
    } else {
        stringArray(R.array.steps_pickup)
    }
    val current = stepIndex(fulfillment, status)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(SoftCardShape)
            .background(Color.White)
            .border(1.dp, Border, SoftCardShape)
            .padding(16.dp),
    ) {
        steps.forEachIndexed { index, label ->
            val done = status == "DELIVERED" || index < current
            val active = status != "DELIVERED" && index == current
            val ringColor by animateColorAsState(
                targetValue = if (done || active) PrimaryGreen else Border,
                animationSpec = tween(360, easing = FastOutSlowInEasing),
                label = "timelineRing",
            )
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                Box(
                    Modifier
                        .size(30.dp)
                        .background(if (done) PrimaryGreen else Color.Transparent, CircleShape)
                        .border(2.dp, ringColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (done) Icon(Icons.Outlined.Check, label, tint = Color.White, modifier = Modifier.size(16.dp))
                    else if (active) PulseDot(color = PrimaryGreen, size = 8.dp)
                }
                Text(
                    label,
                    modifier = Modifier.padding(start = 12.dp),
                    color = if (index > current && status != "DELIVERED") Muted else Ink,
                    style = if (active) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun stringArray(id: Int): List<String> = LocalContext.current.resources.getStringArray(id).toList()

@Composable
private fun statusLabel(status: String, fulfillment: String): String = when (status) {
    "NEW" -> stringResource(R.string.status_new)
    "PREPARING" -> stringResource(R.string.status_preparing)
    "READY" -> stringResource(if (fulfillment == "DELIVERY") R.string.status_ready_delivery else R.string.status_ready_pickup)
    "OUT_FOR_DELIVERY" -> stringResource(R.string.status_out)
    "DELIVERED" -> stringResource(R.string.status_delivered)
    "CANCELLED" -> stringResource(R.string.cancelled)
    else -> status
}

private fun stepIndex(fulfillment: String, status: String): Int = when (status) {
    "NEW" -> 0
    "PREPARING" -> 1
    "READY" -> 2
    "OUT_FOR_DELIVERY" -> 3
    "DELIVERED" -> if (fulfillment == "DELIVERY") 4 else 3
    else -> 0
}

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val api: CafeApi,
    private val session: SessionStore,
    private val notifications: com.cafejavid.data.NotificationStore,
    @dagger.hilt.android.qualifiers.ApplicationContext private val context: android.content.Context,
) : ViewModel() {
    val sessionFlow = session.session
    private val _profile = MutableStateFlow<UserDto?>(null)
    val profile = _profile.asStateFlow()
    private val _addresses = MutableStateFlow<List<AddressDto>>(emptyList())
    val addresses = _addresses.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private val _saved = MutableStateFlow(false)
    val saved = _saved.asStateFlow()

    fun load() {
        viewModelScope.launch {
            if (session.session.first().accessToken.isNullOrBlank()) return@launch
            runCatching { api.addresses() }.onSuccess { _addresses.value = it }.onFailure { _error.value = "network" }
            runCatching { api.me() }
                .onSuccess { user ->
                    _profile.value = user
                    session.saveProfile(
                        name = user.name,
                        firstName = user.firstName,
                        lastName = user.lastName,
                        birthDate = user.birthDate,
                        customerCode = user.customerCode,
                    )
                }
        }
    }

    fun saveProfile(firstName: String, lastName: String, birthDate: String?) {
        viewModelScope.launch {
            _saved.value = false
            val first = firstName.trim()
            val last = lastName.trim()
            val fullName = listOf(first, last).filter { it.isNotBlank() }.joinToString(" ").ifBlank { null }
            runCatching {
                api.updateMe(
                    NameBody(
                        name = fullName,
                        firstName = first.ifBlank { null },
                        lastName = last.ifBlank { null },
                        birthDate = birthDate?.trim()?.ifBlank { null },
                    ),
                )
            }
                .onSuccess { user ->
                    _profile.value = user
                    session.saveProfile(
                        name = user.name,
                        firstName = user.firstName,
                        lastName = user.lastName,
                        birthDate = user.birthDate,
                        customerCode = user.customerCode,
                    )
                    _saved.value = true
                    notifications.push(
                        context.getString(R.string.notif_profile_title),
                        context.getString(R.string.notif_profile_body),
                    )
                }
                .onFailure { _error.value = it.apiMessage() }
        }
    }

    fun saveAddress(id: String?, title: String, details: String, lat: Double, lng: Double, onDone: () -> Unit) {
        viewModelScope.launch {
            val trimmedTitle = title.trim()
            val body = AddressDto(id = id.orEmpty(), title = trimmedTitle, details = details.trim(), lat = lat, lng = lng)
            val result = if (id.isNullOrBlank()) {
                runCatching { api.createAddress(body) }
            } else {
                runCatching { api.updateAddress(id, body) }
            }
            result
                .onSuccess {
                    notifications.push(
                        context.getString(R.string.notif_address_title),
                        context.getString(R.string.notif_address_body, trimmedTitle),
                    )
                    load()
                    onDone()
                }
                .onFailure { _error.value = it.apiMessage() }
        }
    }

    fun deleteAddress(id: String) {
        viewModelScope.launch {
            runCatching { api.deleteAddress(id) }.onSuccess { load() }.onFailure { _error.value = it.apiMessage() }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            val refresh = session.session.first().refreshToken
            if (!refresh.isNullOrBlank()) runCatching { api.logout(com.cafejavid.data.RefreshBody(refresh)) }
            session.clear()
            onDone()
        }
    }
}

@Composable
private fun ProfileField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    singleLine: Boolean = true,
    enabled: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        enabled = enabled,
        placeholder = placeholder?.let { { Text(it, color = Muted) } },
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            disabledContainerColor = Background,
            focusedBorderColor = Border,
            unfocusedBorderColor = Border,
            cursorColor = PrimaryGreen,
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
        ),
    )
}

@Composable
fun ProfileScreen(onLoggedOut: () -> Unit, onLogin: () -> Unit, vm: ProfileViewModel = hiltViewModel()) {
    val session by vm.sessionFlow.collectAsState(Session())
    val profile by vm.profile.collectAsState()
    val addresses by vm.addresses.collectAsState()
    val saved by vm.saved.collectAsState()
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var birthDate by remember { mutableStateOf("") }
    var showBirthPicker by remember { mutableStateOf(false) }
    var addressFormOpen by remember { mutableStateOf(false) }
    var editingId by remember { mutableStateOf<String?>(null) }
    var editingLat by remember { mutableStateOf(35.72) }
    var editingLng by remember { mutableStateOf(51.33) }
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    LaunchedEffect(session.accessToken) { vm.load() }
    LaunchedEffect(profile?.id, profile?.firstName, profile?.lastName, profile?.birthDate, profile?.name) {
        val user = profile ?: return@LaunchedEffect
        if (!user.firstName.isNullOrBlank() || !user.lastName.isNullOrBlank()) {
            firstName = user.firstName.orEmpty()
            lastName = user.lastName.orEmpty()
        } else if (!user.name.isNullOrBlank()) {
            val parts = user.name!!.trim().split(Regex("\\s+"), limit = 2)
            firstName = parts.getOrNull(0).orEmpty()
            lastName = parts.getOrNull(1).orEmpty()
        } else {
            firstName = ""
            lastName = ""
        }
        birthDate = user.birthDate.orEmpty()
    }
    fun closeAddressForm() {
        addressFormOpen = false
        editingId = null
        title = ""
        details = ""
        editingLat = 35.72
        editingLng = 51.33
    }
    fun openAddAddress() {
        editingId = null
        title = ""
        details = ""
        editingLat = 35.72
        editingLng = 51.33
        addressFormOpen = true
    }
    fun openEditAddress(address: AddressDto) {
        editingId = address.id
        title = address.title
        details = address.details
        editingLat = address.lat
        editingLng = address.lng
        addressFormOpen = true
    }
    if (showBirthPicker) {
        JalaliBirthDateDialog(
            initial = birthDate,
            onDismiss = { showBirthPicker = false },
            onConfirm = {
                birthDate = it
                showBirthPicker = false
            },
        )
    }
    Column(
        Modifier
            .fillMaxSize()
            .background(Background)
            .cafeScreenEnter()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Text(stringResource(R.string.tab_profile), style = MaterialTheme.typography.headlineSmall)
        if (session.accessToken.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            CafeButton(stringResource(R.string.login_title), onLogin, Modifier.height(52.dp))
            return@Column
        }
        Spacer(Modifier.height(16.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .shadow(
                    8.dp,
                    SoftCardShape,
                    ambientColor = PrimaryGreen.copy(alpha = 0.06f),
                    spotColor = PrimaryGreen.copy(alpha = 0.1f),
                )
                .clip(SoftCardShape)
                .background(Color.White)
                .border(1.dp, Border, SoftCardShape)
                .padding(16.dp),
        ) {
            Text(stringResource(R.string.user_info), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(14.dp))
            val code = profile?.customerCode ?: session.customerCode
            if (!code.isNullOrBlank()) {
                Text(stringResource(R.string.customer_code), style = MaterialTheme.typography.bodySmall, color = Muted)
                Spacer(Modifier.height(6.dp))
                Text(
                    toPersianDigits(code),
                    style = MaterialTheme.typography.titleLarge,
                    color = PrimaryGreen,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(RadiusMd))
                        .background(PrimaryTint)
                        .border(1.dp, PrimaryGreen.copy(alpha = 0.2f), RoundedCornerShape(RadiusMd))
                        .padding(horizontal = 14.dp, vertical = 16.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            Text(stringResource(R.string.first_name), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            ProfileField(firstName, { firstName = it.take(40) }, placeholder = stringResource(R.string.first_name_hint))
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.last_name), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            ProfileField(lastName, { lastName = it.take(40) }, placeholder = stringResource(R.string.last_name_hint))
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.birth_date), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            Text(
                if (birthDate.isBlank()) stringResource(R.string.birth_date_hint) else toPersianDigits(birthDate),
                color = if (birthDate.isBlank()) Muted else Ink,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .border(1.dp, Border, RoundedCornerShape(14.dp))
                    .clickable { showBirthPicker = true }
                    .padding(horizontal = 14.dp, vertical = 16.dp),
            )
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.phone_readonly), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            Text(
                toPersianDigits(session.phone.orEmpty()),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Background)
                    .border(1.dp, Border, RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 16.dp),
            )
            CafeButton(
                stringResource(R.string.save_profile),
                { vm.saveProfile(firstName, lastName, birthDate.ifBlank { null }) },
                Modifier.padding(top = 12.dp).fillMaxWidth().height(48.dp),
                enabled = firstName.isNotBlank() || lastName.isNotBlank(),
            )
            if (saved) {
                Text(stringResource(R.string.profile_saved), color = PrimaryGreen, modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.saved_addresses), style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(10.dp))
        if (addresses.isEmpty() && !addressFormOpen) {
            Text(
                stringResource(R.string.empty_addresses),
                color = Muted,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(SoftCardShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftCardShape)
                    .padding(16.dp),
            )
            Spacer(Modifier.height(10.dp))
        }
        addresses.forEach { address ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp)
                    .shadow(
                        6.dp,
                        SoftCardShape,
                        ambientColor = PrimaryGreen.copy(alpha = 0.05f),
                        spotColor = PrimaryGreen.copy(alpha = 0.08f),
                    )
                    .clip(SoftCardShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftCardShape)
                    .padding(14.dp),
            ) {
                Text(address.title, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(4.dp))
                Text(address.details, style = MaterialTheme.typography.bodyMedium, color = Muted)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        stringResource(R.string.edit),
                        color = PrimaryGreen,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.clickable { openEditAddress(address) },
                    )
                    Text(
                        stringResource(R.string.remove),
                        color = Muted,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.clickable { vm.deleteAddress(address.id) },
                    )
                }
            }
        }
        if (!addressFormOpen) {
            CafeOutlinedButton(stringResource(R.string.add_address), ::openAddAddress, Modifier.fillMaxWidth().height(48.dp))
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(14.dp),
            ) {
                Text(
                    stringResource(if (editingId == null) R.string.add_address else R.string.edit_address),
                    style = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.address_title), style = MaterialTheme.typography.bodySmall, color = Muted)
                Spacer(Modifier.height(6.dp))
                ProfileField(title, { title = it }, placeholder = stringResource(R.string.address_title))
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.address_details), style = MaterialTheme.typography.bodySmall, color = Muted)
                Spacer(Modifier.height(6.dp))
                ProfileField(
                    details,
                    { details = it },
                    placeholder = stringResource(R.string.address_details),
                    singleLine = false,
                )
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CafeOutlinedButton(stringResource(R.string.cancel), ::closeAddressForm, Modifier.weight(1f).height(48.dp))
                    CafeButton(
                        stringResource(R.string.save),
                        {
                            if (title.isNotBlank() && details.isNotBlank()) {
                                vm.saveAddress(editingId, title, details, editingLat, editingLng, ::closeAddressForm)
                            }
                        },
                        Modifier.weight(1f).height(48.dp),
                        enabled = title.isNotBlank() && details.isNotBlank(),
                    )
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        CafeButton(stringResource(R.string.logout), { vm.logout(onLoggedOut) }, Modifier.fillMaxWidth().height(54.dp), dark = true)
    }
}
