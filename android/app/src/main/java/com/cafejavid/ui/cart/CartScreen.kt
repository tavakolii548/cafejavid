package com.cafejavid.ui.cart

import android.content.Context
import android.widget.Toast
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cafejavid.R
import com.cafejavid.data.AddressDto
import com.cafejavid.data.CafeApi
import com.cafejavid.data.CafeConfig
import com.cafejavid.data.CartLine
import com.cafejavid.data.CartStore
import com.cafejavid.data.CheckoutGate
import com.cafejavid.data.CreateItemBody
import com.cafejavid.data.CreateOrderBody
import com.cafejavid.data.InlineAddressBody
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.SessionStore
import com.cafejavid.data.ValidateDiscountBody
import com.cafejavid.di.apiMessage
import com.cafejavid.ui.common.CafeEmptyState
import com.cafejavid.ui.common.SoftCardShape
import com.cafejavid.ui.common.cafeScreenEnter
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.CafeButton
import com.cafejavid.ui.theme.Danger
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.ui.theme.RadiusMd
import com.cafejavid.util.formatPrice
import com.cafejavid.util.toPersianDigits
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import java.util.UUID
import javax.inject.Inject

data class CartUi(
    val config: CafeConfig = CafeConfig(),
    val addresses: List<AddressDto> = emptyList(),
    val addressId: String? = null,
    val lat: Double = 35.7219,
    val lng: Double = 51.3347,
    val details: String = "",
    val discountCode: String = "",
    val appliedDiscountCode: String? = null,
    val discountAmount: Int = 0,
    val discountMessage: String? = null,
    val loggedIn: Boolean = false,
    val error: String? = null,
    val loading: Boolean = false,
    val showMap: Boolean = false,
)

@HiltViewModel
class CartViewModel @Inject constructor(
    private val api: CafeApi,
    private val cart: CartStore,
    private val session: SessionStore,
    private val gate: CheckoutGate,
    private val notifications: NotificationStore,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    private val _state = MutableStateFlow(CartUi())
    val state = _state.asStateFlow()
    val lines = cart.lines
    private var idempotencyKey = UUID.randomUUID().toString()

    init { reload() }

    fun reload() {
        viewModelScope.launch {
            val loggedIn = !session.session.first().accessToken.isNullOrBlank()
            val config = runCatching { api.config() }.getOrDefault(CafeConfig())
            val addresses = if (loggedIn) runCatching { api.addresses() }.getOrDefault(emptyList()) else emptyList()
            _state.update {
                it.copy(
                    config = config,
                    addresses = addresses,
                    loggedIn = loggedIn,
                    addressId = it.addressId ?: addresses.firstOrNull()?.id,
                )
            }
        }
    }

    fun setAddress(id: String) = _state.update { it.copy(addressId = id, showMap = false) }
    fun setDetails(value: String) = _state.update { it.copy(details = value) }
    fun setDiscountCode(value: String) = _state.update {
        it.copy(
            discountCode = value,
            discountMessage = null,
            appliedDiscountCode = null,
            discountAmount = 0,
        )
    }
    fun showMap(show: Boolean) = _state.update { it.copy(showMap = show) }
    fun pick(lat: Double, lng: Double) = _state.update { it.copy(lat = lat, lng = lng, addressId = null) }

    fun applyDiscount() {
        viewModelScope.launch {
            val code = _state.value.discountCode.trim()
            if (code.isBlank()) {
                _state.update { it.copy(discountMessage = context.getString(R.string.discount_code_hint)) }
                return@launch
            }
            val loggedIn = !session.session.first().accessToken.isNullOrBlank()
            if (!loggedIn) {
                _state.update { it.copy(discountMessage = context.getString(R.string.login_required)) }
                return@launch
            }
            val subtotal = cart.lines.first().sumOf { it.unitPrice * it.quantity }
            _state.update { it.copy(loading = true, error = null, discountMessage = null) }
            runCatching { api.validateDiscount(ValidateDiscountBody(code, subtotal)) }
                .onSuccess { result ->
                    _state.update {
                        it.copy(
                            appliedDiscountCode = result.code,
                            discountAmount = result.discountAmount,
                            discountMessage = "کد ${result.code} اعمال شد",
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            appliedDiscountCode = null,
                            discountAmount = 0,
                            discountMessage = error.apiMessage() ?: context.getString(R.string.error_network),
                        )
                    }
                }
            _state.update { it.copy(loading = false) }
        }
    }

    fun changeQty(id: String, delta: Int) {
        viewModelScope.launch {
            cart.update { lines ->
                lines.mapNotNull { line ->
                    if (line.localId != id) line
                    else {
                        val qty = line.quantity + delta
                        if (qty <= 0) null else line.copy(quantity = qty.coerceAtMost(20))
                    }
                }
            }
        }
    }

    private fun toast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
    }

    fun checkout(onNeedLogin: () -> Unit, onOrdered: (String) -> Unit) {
        viewModelScope.launch {
            val current = session.session.first()
            if (current.accessToken.isNullOrBlank()) {
                gate.pending = true
                toast(context.getString(R.string.login_required_checkout))
                onNeedLogin()
                return@launch
            }
            val ui = _state.value
            if (!ui.config.acceptingOrders) {
                val msg = context.getString(R.string.not_accepting_detail)
                _state.update { it.copy(error = msg) }
                toast(msg)
                return@launch
            }
            val lines = cart.lines.first()
            if (lines.isEmpty()) {
                val msg = context.getString(R.string.empty_cart)
                _state.update { it.copy(error = msg) }
                toast(msg)
                return@launch
            }
            val subtotal = lines.sumOf { it.unitPrice * it.quantity }
            if (ui.config.minOrder > 0 && subtotal < ui.config.minOrder) {
                val msg = context.getString(R.string.min_order_block)
                _state.update { it.copy(error = msg) }
                toast(msg)
                return@launch
            }
            if (ui.addressId == null && ui.details.isBlank()) {
                val msg = context.getString(R.string.address_required_checkout)
                _state.update { it.copy(error = msg) }
                toast(msg)
                return@launch
            }
            val body = CreateOrderBody(
                fulfillment = "DELIVERY",
                tableNumber = null,
                addressId = ui.addressId,
                address = if (ui.addressId == null) {
                    InlineAddressBody(
                        title = "آدرس تحویل",
                        details = ui.details.trim(),
                        lat = ui.lat,
                        lng = ui.lng,
                    )
                } else null,
                paymentMethod = "CASH",
                discountCode = ui.appliedDiscountCode ?: ui.discountCode.trim().ifBlank { null },
                items = lines.map { CreateItemBody(it.productId, it.quantity, it.choiceIds, it.note) },
            )
            _state.update { it.copy(loading = true, error = null) }
            runCatching { api.createOrder(idempotencyKey, body) }
                .onSuccess { order ->
                    idempotencyKey = UUID.randomUUID().toString()
                    cart.setLines(emptyList())
                    notifications.push(
                        context.getString(R.string.notif_order_title),
                        context.getString(R.string.notif_order_body, toPersianDigits(order.number)),
                    )
                    toast(context.getString(R.string.order_placed_ok, toPersianDigits(order.number)))
                    onOrdered(order.id)
                }
                .onFailure { error ->
                    val msg = error.apiMessage() ?: context.getString(R.string.error_network)
                    _state.update { it.copy(error = msg) }
                    toast(msg)
                }
            _state.update { it.copy(loading = false) }
        }
    }
}

@Composable
fun CartScreen(onBack: () -> Unit, onNeedLogin: () -> Unit, onOrdered: (String) -> Unit, vm: CartViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val lines by vm.lines.collectAsState(emptyList())
    if (state.showMap) {
        MapPicker(state.lat, state.lng, onPick = vm::pick, onClose = { vm.showMap(false) })
        return
    }
    val subtotal = lines.sumOf { it.unitPrice * it.quantity }
    val deliveryFee = if (lines.isNotEmpty()) state.config.deliveryFee else 0
    val packagingFee = if (lines.isNotEmpty()) state.config.packagingFee else 0
    val belowMin = state.config.minOrder > 0 && subtotal < state.config.minOrder
    val canPlace = lines.isNotEmpty() && !state.loading && state.config.acceptingOrders && !belowMin
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(
            Modifier.cafeScreenEnter().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.size(44.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.back), tint = Ink)
            }
            Text(stringResource(R.string.cart_title), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
        }
        if (!state.config.acceptingOrders) {
            Text(
                stringResource(R.string.not_accepting_detail),
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(RadiusMd))
                    .background(PrimaryTint)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                color = PrimaryGreen,
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(8.dp))
        }
        if (state.config.openingHours.isNotBlank()) {
            Text(
                stringResource(R.string.opening_hours, toPersianDigits(state.config.openingHours)),
                modifier = Modifier.padding(horizontal = 20.dp),
                color = Muted,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(4.dp))
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Text(stringResource(R.string.delivery), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.delivery_only_hint),
                color = Muted,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )
            Spacer(Modifier.height(14.dp))
            if (lines.isEmpty()) {
                CafeEmptyState(
                    icon = Icons.Outlined.ShoppingBag,
                    title = stringResource(R.string.empty_cart),
                )
            }
            lines.forEach { line ->
                LineRow(line, onMinus = { vm.changeQty(line.localId, -1) }, onPlus = { vm.changeQty(line.localId, 1) })
            }
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.pick_address), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .clickable { vm.showMap(true) }
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.LocationOn, stringResource(R.string.map_title), tint = PrimaryGreen)
                Text(stringResource(R.string.pick_address), modifier = Modifier.padding(start = 8.dp))
            }
            state.addresses.forEach { address ->
                val on = state.addressId == address.id
                Text(
                    "${address.title} · ${address.details}",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                        .border(1.dp, if (on) PrimaryGreen else Border, RoundedCornerShape(14.dp))
                        .clickable { vm.setAddress(address.id) }
                        .padding(12.dp),
                    color = Ink,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.address_details), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = state.details,
                onValueChange = vm::setDetails,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.address_details), color = Muted) },
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    disabledContainerColor = Color.White,
                    focusedBorderColor = Border,
                    unfocusedBorderColor = Border,
                    cursorColor = PrimaryGreen,
                    focusedTextColor = Ink,
                    unfocusedTextColor = Ink,
                ),
            )
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.payment_method), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.pay_cash),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
                    .height(50.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(PrimaryTint)
                    .border(1.dp, PrimaryGreen.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                color = PrimaryGreen,
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.discount_code), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = state.discountCode,
                    onValueChange = vm::setDiscountCode,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(stringResource(R.string.discount_code_hint), color = Muted) },
                    singleLine = true,
                    shape = RoundedCornerShape(RadiusMd),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        disabledContainerColor = Color.White,
                        focusedBorderColor = Border,
                        unfocusedBorderColor = Border,
                        cursorColor = PrimaryGreen,
                        focusedTextColor = Ink,
                        unfocusedTextColor = Ink,
                    ),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.apply_discount),
                    modifier = Modifier
                        .clip(RoundedCornerShape(RadiusMd))
                        .background(Color.White)
                        .border(1.dp, PrimaryGreen, RoundedCornerShape(RadiusMd))
                        .clickable(enabled = !state.loading) { vm.applyDiscount() }
                        .padding(horizontal = 12.dp, vertical = 14.dp),
                    color = PrimaryGreen,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            state.discountMessage?.let {
                Text(it, color = PrimaryGreen, modifier = Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(14.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(SoftCardShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftCardShape)
                    .padding(14.dp),
            ) {
                Text(stringResource(R.string.fee_summary_hint), style = MaterialTheme.typography.bodySmall, color = Muted)
                SummaryRow(stringResource(R.string.subtotal), formatPrice(subtotal))
                if (state.config.minOrder > 0) {
                    SummaryRow(stringResource(R.string.min_order), formatPrice(state.config.minOrder))
                }
                SummaryRow(
                    stringResource(R.string.delivery_fee),
                    if (deliveryFee == 0) stringResource(R.string.delivery_free) else formatPrice(deliveryFee),
                )
                SummaryRow(stringResource(R.string.packaging_fee), formatPrice(packagingFee))
                if (state.discountAmount > 0) {
                    SummaryRow(stringResource(R.string.discount_amount), formatPrice(-state.discountAmount))
                }
                Spacer(Modifier.height(6.dp))
                SummaryRow(
                    stringResource(R.string.payable),
                    formatPrice((subtotal - state.discountAmount + deliveryFee + packagingFee).coerceAtLeast(0)),
                    emphasize = true,
                )
            }
            if (belowMin) {
                Text(
                    stringResource(R.string.min_order_block),
                    color = Danger,
                    modifier = Modifier.padding(top = 10.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Spacer(Modifier.height(12.dp))
        }
        state.error?.let {
            Text(
                it,
                color = Danger,
                modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .border(1.dp, Border)
                .padding(horizontal = 20.dp, vertical = 14.dp),
        ) {
            CafeButton(
                if (state.loading) stringResource(R.string.placing_order) else stringResource(R.string.place_order),
                { vm.checkout(onNeedLogin, onOrdered) },
                Modifier.fillMaxWidth().height(54.dp),
                enabled = canPlace,
            )
        }
    }
}

@Composable
private fun QtyStepper(quantity: Int, onMinus: () -> Unit, onPlus: () -> Unit) {
    Row(
        Modifier
            .height(44.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Background)
            .border(1.dp, Border, RoundedCornerShape(12.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "−",
            modifier = Modifier
                .size(44.dp)
                .clickable(onClick = onMinus)
                .padding(vertical = 10.dp),
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            color = Ink,
        )
        Text(
            toPersianDigits(quantity),
            modifier = Modifier.width(32.dp),
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
        )
        Text(
            "+",
            modifier = Modifier
                .size(44.dp)
                .clickable(onClick = onPlus)
                .padding(vertical = 10.dp),
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            color = Ink,
        )
    }
}

@Composable
private fun LineRow(line: CartLine, onMinus: () -> Unit, onPlus: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
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
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(line.name, style = MaterialTheme.typography.titleMedium)
                if (line.optionSummary.isNotBlank()) {
                    Text(line.optionSummary, style = MaterialTheme.typography.bodySmall, color = Muted)
                }
            }
            Text(
                formatPrice(line.unitPrice * line.quantity),
                color = PrimaryGreen,
                style = MaterialTheme.typography.titleMedium,
            )
        }
        Spacer(Modifier.height(12.dp))
        QtyStepper(quantity = line.quantity, onMinus = onMinus, onPlus = onPlus)
    }
}

@Composable
private fun SummaryRow(label: String, value: String, emphasize: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            label,
            color = if (emphasize) Ink else Muted,
            style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
        )
        Text(
            value,
            color = if (emphasize) PrimaryGreen else Ink,
            style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun MapPicker(lat: Double, lng: Double, onPick: (Double, Double) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    var pointLat by remember { mutableDoubleStateOf(lat) }
    var pointLng by remember { mutableDoubleStateOf(lng) }
    val map = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(14.0)
            controller.setCenter(GeoPoint(lat, lng))
        }
    }
    DisposableEffect(map) {
        val receiver = object : MapEventsReceiver {
            override fun singleTapConfirmedHelper(p: GeoPoint): Boolean {
                pointLat = p.latitude
                pointLng = p.longitude
                onPick(p.latitude, p.longitude)
                return true
            }
            override fun longPressHelper(p: GeoPoint) = false
        }
        map.overlays.add(MapEventsOverlay(receiver))
        map.onResume()
        onDispose { map.onPause() }
    }
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.back)) }
            Text(stringResource(R.string.map_title), style = MaterialTheme.typography.titleMedium)
        }
        AndroidView(factory = { map }, modifier = Modifier.weight(1f).fillMaxWidth(), update = { view ->
            view.overlays.removeAll { it is Marker }
            view.overlays.add(Marker(view).apply {
                position = GeoPoint(pointLat, pointLng)
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            })
            view.invalidate()
        })
        CafeButton(stringResource(R.string.confirm_map), onClose, Modifier.padding(16.dp).fillMaxWidth().height(54.dp))
    }
}
