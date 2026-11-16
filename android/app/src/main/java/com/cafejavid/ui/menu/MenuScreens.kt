package com.cafejavid.ui.menu

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.LocalCafe
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.cafejavid.R
import com.cafejavid.data.CartLine
import com.cafejavid.data.CartStore
import com.cafejavid.data.CafeApi
import com.cafejavid.data.GroupDto
import com.cafejavid.data.MenuResponse
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.ProductDto
import com.cafejavid.data.SessionStore
import com.cafejavid.data.WelcomeContent
import com.cafejavid.data.WelcomeGate
import com.cafejavid.ui.theme.Accent
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.CafeButton
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Lilac
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.ui.theme.Sand
import com.cafejavid.util.formatPrice
import com.cafejavid.util.toPersianDigits
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class MenuState(
    val menu: MenuResponse? = null,
    val cafeName: String = "",
    val categoryId: String? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class MenuViewModel @Inject constructor(
    private val api: CafeApi,
    val cart: CartStore,
    val session: SessionStore,
    private val welcome: WelcomeGate,
    private val notifications: NotificationStore,
) : ViewModel() {
    private val _state = MutableStateFlow(MenuState())
    val state = _state.asStateFlow()
    val unreadNotifications = notifications.unreadCount
    private val _welcome = MutableStateFlow<WelcomeContent?>(null)
    val welcomeContent = _welcome.asStateFlow()

    init {
        refresh()
        _welcome.value = welcome.consume()
        viewModelScope.launch {
            val current = session.session.first()
            notifications.maybePushBirthday(current.birthDate, current.name)
            if (!current.accessToken.isNullOrBlank()) {
                runCatching { api.myNotifications() }
                    .onSuccess { notifications.mergeServer(it) }
            }
        }
    }

    fun dismissWelcome() {
        _welcome.value = null
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            runCatching {
                val config = api.config()
                val menu = api.menu()
                config to menu
            }.onSuccess { (config, menu) ->
                _state.update { it.copy(loading = false, menu = menu, cafeName = config.cafeName) }
            }.onFailure {
                _state.update { it.copy(loading = false, error = "network") }
            }
        }
    }

    fun select(id: String?) = _state.update { it.copy(categoryId = id) }

    fun addSimple(product: ProductDto) {
        viewModelScope.launch {
            cart.update { lines ->
                val existing = lines.indexOfFirst { it.productId == product.id && it.choiceIds.isEmpty() && it.note.isNullOrBlank() }
                if (existing >= 0) {
                    lines.mapIndexed { index, line ->
                        if (index == existing) line.copy(quantity = (line.quantity + 1).coerceAtMost(20)) else line
                    }
                } else {
                    lines + CartLine(UUID.randomUUID().toString(), product.id, product.name, 1, emptyList(), "", product.price, null)
                }
            }
        }
    }

    fun product(id: String): ProductDto? =
        _state.value.menu?.categories?.flatMap { it.products }?.find { it.id == id }
}

@Composable
private fun WelcomeDialog(
    content: WelcomeContent,
    onDismiss: () -> Unit,
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }
    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0.92f,
        animationSpec = tween(420, easing = FastOutSlowInEasing),
        label = "welcomeScale",
    )
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(360, easing = FastOutSlowInEasing),
        label = "welcomeAlpha",
    )
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .scale(scale)
                .alpha(alpha),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .shadow(22.dp, RoundedCornerShape(28.dp), ambientColor = PrimaryGreen.copy(alpha = 0.25f), spotColor = PrimaryGreen.copy(alpha = 0.35f))
                    .clip(RoundedCornerShape(28.dp))
                    .background(Color.White),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(168.dp)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFF163A2C), PrimaryGreen, Color(0xFF2A6B4F)),
                            ),
                        ),
                ) {
                    Box(
                        Modifier
                            .size(150.dp)
                            .align(Alignment.TopStart)
                            .offset(x = (-36).dp, y = (-40).dp)
                            .background(Color.White.copy(alpha = 0.08f), CircleShape),
                    )
                    Box(
                        Modifier
                            .size(110.dp)
                            .align(Alignment.BottomEnd)
                            .offset(x = 28.dp, y = 34.dp)
                            .background(Accent.copy(alpha = 0.22f), CircleShape),
                    )
                    Column(
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = 22.dp, vertical = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Box(
                            Modifier
                                .size(72.dp)
                                .shadow(10.dp, CircleShape)
                                .clip(CircleShape)
                                .background(Color.White)
                                .padding(10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Image(
                                painter = painterResource(R.drawable.cafe_logo),
                                contentDescription = stringResource(R.string.cd_logo),
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Fit,
                            )
                        }
                        Spacer(Modifier.height(12.dp))
                        Text(
                            stringResource(R.string.welcome_eyebrow),
                            color = Accent,
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.2.sp,
                            ),
                        )
                    }
                }
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFFFFFBF4), Color.White, PrimaryTint.copy(alpha = 0.35f)),
                            ),
                        )
                        .padding(horizontal = 22.dp, vertical = 22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Sand)
                            .border(1.dp, Accent.copy(alpha = 0.45f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.LocalCafe, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        content.title,
                        style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp, lineHeight = 32.sp),
                        color = Ink,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    Box(
                        Modifier
                            .width(48.dp)
                            .height(3.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(Accent),
                    )
                    Spacer(Modifier.height(14.dp))
                    Text(
                        content.body,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 26.sp),
                        color = Muted,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(22.dp))
                    CafeButton(
                        text = stringResource(R.string.welcome_cta),
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun MenuScreen(
    onProduct: (String) -> Unit,
    onCart: () -> Unit,
    onNotifications: () -> Unit,
    vm: MenuViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsState()
    val cart by vm.cart.lines.collectAsState(emptyList())
    val unread by vm.unreadNotifications.collectAsState(0)
    val welcomeContent by vm.welcomeContent.collectAsState()
    val network = stringResource(R.string.error_network)
    welcomeContent?.let { content ->
        WelcomeDialog(content = content, onDismiss = vm::dismissWelcome)
    }
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.hello), style = MaterialTheme.typography.bodySmall)
                Text(state.cafeName.ifBlank { stringResource(R.string.app_name) }, style = MaterialTheme.typography.headlineSmall)
            }
            Box {
                IconButton(onClick = onNotifications, modifier = Modifier.size(44.dp).border(1.dp, Border, RoundedCornerShape(14.dp))) {
                    Icon(Icons.Outlined.Notifications, stringResource(R.string.notifications), tint = Ink)
                }
                if (unread > 0) {
                    Box(
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Accent),
                    )
                }
            }
        }
        if (state.error != null) {
            Column(Modifier.padding(20.dp)) {
                Text(network)
                CafeButton(stringResource(R.string.retry), vm::refresh, Modifier.padding(top = 12.dp).height(52.dp))
            }
        }
        val menu = state.menu
        if (menu != null) {
            val chips = listOf<Pair<String?, String>>(null to stringResource(R.string.all)) + menu.categories.map { it.id to it.name }
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                chips.forEach { (id, label) ->
                    val selected = state.categoryId == id
                    Text(
                        label,
                        modifier = Modifier.height(40.dp).clip(RoundedCornerShape(20.dp)).background(if (selected) PrimaryGreen else Color.White).border(1.dp, Border, RoundedCornerShape(20.dp)).clickable { vm.select(id) }.padding(horizontal = 16.dp, vertical = 10.dp),
                        color = if (selected) Color.White else Ink,
                    )
                }
            }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                val featured = menu.featured
                if (featured != null && state.categoryId == null) {
                    Spacer(Modifier.height(16.dp))
                    FeaturedCard(featured, onClick = { onProduct(featured.id) })
                }
                Spacer(Modifier.height(18.dp))
                val allProducts = menu.categories.flatMap { it.products }
                val products = if (state.categoryId == null) {
                    allProducts.take(5)
                } else {
                    menu.categories.filter { it.id == state.categoryId }.flatMap { it.products }
                }
                Text(
                    if (state.categoryId == null) {
                        stringResource(R.string.bestsellers)
                    } else {
                        menu.categories.find { it.id == state.categoryId }?.name
                            ?: stringResource(R.string.category_items)
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(10.dp))
                products.forEachIndexed { index, product ->
                    ProductRow(product, index, onOpen = { onProduct(product.id) }, onAdd = {
                        if (product.optionGroups.isEmpty()) vm.addSimple(product) else onProduct(product.id)
                    })
                    Spacer(Modifier.height(10.dp))
                }
                Spacer(Modifier.height(if (cart.isEmpty()) 12.dp else 88.dp))
            }
        }
        if (cart.isNotEmpty()) {
            val count = cart.sumOf { it.quantity }
            val total = cart.sumOf { it.unitPrice * it.quantity }
            Row(
                Modifier.padding(horizontal = 20.dp, vertical = 8.dp).fillMaxWidth().height(64.dp).clip(RoundedCornerShape(18.dp)).background(Ink).clickable(onClick = onCart).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(28.dp).background(Accent, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                    Text(toPersianDigits(count), color = Ink, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.view_cart), color = Color.White, modifier = Modifier.weight(1f))
                Text(formatPrice(total), color = Color.White)
            }
        }
    }
}

@Composable
private fun FeaturedCard(product: ProductDto, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(PrimaryGreen).clickable(onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(stringResource(R.string.featured_badge), color = Ink, modifier = Modifier.background(Accent, RoundedCornerShape(12.dp)).padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
            Text(product.name, color = Color.White, style = MaterialTheme.typography.titleMedium)
            Text(product.description, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodySmall)
        }
        ProductArt(product.imageUrl, PrimaryTint, Modifier.size(72.dp))
    }
}

@Composable
private fun ProductRow(product: ProductDto, index: Int, onOpen: () -> Unit, onAdd: () -> Unit) {
    val tint = listOf(PrimaryTint, Sand, Lilac)[index % 3]
    Row(
        Modifier.fillMaxWidth().alpha(if (product.soldOut) 0.45f else 1f).clip(RoundedCornerShape(18.dp)).background(Color.White).border(1.dp, Border, RoundedCornerShape(18.dp)).clickable(onClick = onOpen).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ProductArt(product.imageUrl, tint, Modifier.size(68.dp), contentScale = ContentScale.Fit)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium)
            if (product.description.isNotBlank()) {
                Text(product.description, style = MaterialTheme.typography.bodySmall, maxLines = 2, color = Muted)
            }
            Text(if (product.soldOut) stringResource(R.string.sold_out) else formatPrice(product.price), style = MaterialTheme.typography.bodyMedium, color = PrimaryGreen)
        }
        IconButton(
            onClick = onAdd,
            enabled = !product.soldOut,
            modifier = Modifier.size(44.dp).background(if (product.soldOut) Border else PrimaryGreen, RoundedCornerShape(14.dp)),
        ) {
            Icon(Icons.Outlined.Add, stringResource(R.string.add), tint = Color.White)
        }
    }
}

@Composable
fun ProductArt(
    url: String?,
    tint: Color,
    modifier: Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    shape: Shape = RoundedCornerShape(14.dp),
) {
    Box(modifier.clip(shape).background(tint), contentAlignment = Alignment.Center) {
        if (!url.isNullOrBlank()) {
            AsyncImage(
                model = url,
                contentDescription = stringResource(R.string.cd_product),
                modifier = Modifier.fillMaxSize().padding(8.dp),
                contentScale = contentScale,
            )
        } else {
            Icon(Icons.Outlined.LocalCafe, stringResource(R.string.cd_product), tint = PrimaryGreen)
        }
    }
}

@Composable
private fun ProductDetailSection(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Border, RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        Text(title, style = MaterialTheme.typography.bodySmall, color = Muted)
        Spacer(Modifier.height(6.dp))
        content()
    }
}

@HiltViewModel
class ProductViewModel @Inject constructor(
    private val menuVmSource: CafeApi,
    private val cart: CartStore,
) : ViewModel() {
    private val _product = MutableStateFlow<ProductDto?>(null)
    val product = _product.asStateFlow()
    val favorites = cart.favorites

    fun load(id: String) {
        viewModelScope.launch {
            if (_product.value?.id == id) return@launch
            runCatching { menuVmSource.menu() }.onSuccess { menu ->
                _product.value = menu.categories.flatMap { it.products }.find { it.id == id }
            }
        }
    }

    fun toggleFavorite(id: String) {
        viewModelScope.launch { cart.toggleFavorite(id) }
    }

    fun add(product: ProductDto, choiceIds: List<String>, summary: String, unit: Int, qty: Int, note: String) {
        viewModelScope.launch {
            cart.update { lines ->
                lines + CartLine(UUID.randomUUID().toString(), product.id, product.name, qty, choiceIds, summary, unit, note.ifBlank { null })
            }
        }
    }
}

@Composable
fun ProductScreen(productId: String, onBack: () -> Unit, vm: ProductViewModel = hiltViewModel()) {
    val product by vm.product.collectAsState()
    val favorites by vm.favorites.collectAsState(emptySet())
    val scope = rememberCoroutineScope()
    androidx.compose.runtime.LaunchedEffect(productId) { vm.load(productId) }
    val item = product
    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            IconButton(onClick = onBack, modifier = Modifier.size(44.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.back), tint = Ink)
            }
            IconButton(onClick = { vm.toggleFavorite(productId) }, modifier = Modifier.size(44.dp)) {
                Icon(if (productId in favorites) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, stringResource(R.string.favorite), tint = PrimaryGreen)
            }
        }
        if (item == null) {
            Text(stringResource(R.string.loading), modifier = Modifier.padding(20.dp))
            return@Column
        }
        val selected = remember(item.id) { mutableStateMapOf<String, String?>().apply { item.optionGroups.forEach { group -> this[group.id] = defaultChoice(group) } } }
        val multi = remember(item.id) { mutableStateMapOf<String, Boolean>() }
        var qty by remember(item.id) { mutableIntStateOf(1) }
        var note by remember(item.id) { mutableStateOf("") }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ProductArt(
                item.imageUrl,
                Color.White,
                Modifier
                    .fillMaxWidth()
                    .height(240.dp)
                    .border(1.dp, Border, RoundedCornerShape(24.dp)),
                contentScale = ContentScale.Fit,
                shape = RoundedCornerShape(24.dp),
            )
            ProductDetailSection(stringResource(R.string.name)) {
                Text(item.name, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Start)
            }
            ProductDetailSection(stringResource(R.string.product_price)) {
                Text(
                    if (item.soldOut) stringResource(R.string.sold_out) else formatPrice(item.price),
                    style = MaterialTheme.typography.titleMedium,
                    color = PrimaryGreen,
                )
            }
            if (item.description.isNotBlank()) {
                ProductDetailSection(stringResource(R.string.product_description)) {
                    Text(item.description, style = MaterialTheme.typography.bodyMedium, color = Ink)
                }
            }
            item.optionGroups.forEach { group ->
                ProductDetailSection(group.name) {
                    if (group.type == "SINGLE") {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            group.choices.forEach { choice ->
                                val on = selected[group.id] == choice.id
                                Text(
                                    choice.name,
                                    modifier = Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(14.dp)).background(if (on) PrimaryGreen else Color.White).border(1.dp, Border, RoundedCornerShape(14.dp)).clickable { selected[group.id] = choice.id }.padding(vertical = 12.dp),
                                    color = if (on) Color.White else Ink,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    } else {
                        group.choices.forEach { choice ->
                            val on = multi[choice.id] == true
                            Row(Modifier.fillMaxWidth().height(52.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(choice.name)
                                    Text(formatPrice(choice.priceDelta), style = MaterialTheme.typography.bodySmall)
                                }
                                Switch(checked = on, onCheckedChange = { multi[choice.id] = it }, colors = SwitchDefaults.colors(checkedTrackColor = PrimaryGreen))
                            }
                        }
                    }
                }
            }
            ProductDetailSection(stringResource(R.string.order_note)) {
                OutlinedTextField(
                    value = note,
                    onValueChange = { if (it.length <= 140) note = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(stringResource(R.string.order_note_hint), color = Muted) },
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
            }
            Spacer(Modifier.height(4.dp))
        }
        val choiceIds = buildList {
            item.optionGroups.filter { it.type == "SINGLE" }.forEach { group -> selected[group.id]?.let { add(it) } }
            item.optionGroups.filter { it.type != "SINGLE" }.forEach { group ->
                group.choices.filter { multi[it.id] == true }.forEach { add(it.id) }
            }
        }
        val summary = item.optionGroups.flatMap { group ->
            group.choices.filter { it.id in choiceIds }.map { it.name }
        }.joinToString(" · ")
        val delta = item.optionGroups.flatMap { it.choices }.filter { it.id in choiceIds }.sumOf { it.priceDelta }
        val total = (item.price + delta) * qty
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .border(1.dp, Border)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier
                    .height(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Background)
                    .border(1.dp, Border, RoundedCornerShape(14.dp)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "−",
                    modifier = Modifier
                        .size(48.dp)
                        .clickable(enabled = qty > 1) { if (qty > 1) qty -= 1 }
                        .padding(vertical = 12.dp),
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    color = if (qty > 1) Ink else Muted,
                )
                Text(
                    toPersianDigits(qty),
                    modifier = Modifier.width(36.dp),
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "+",
                    modifier = Modifier
                        .size(48.dp)
                        .clickable(enabled = qty < 20) { if (qty < 20) qty += 1 }
                        .padding(vertical = 12.dp),
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    color = if (qty < 20) Ink else Muted,
                )
            }
            Spacer(Modifier.width(12.dp))
            androidx.compose.material3.Button(
                onClick = {
                    scope.launch {
                        vm.add(item, choiceIds, summary, item.price + delta, qty, note)
                        onBack()
                    }
                },
                enabled = !item.soldOut && item.optionGroups.filter { it.required && it.type == "SINGLE" }.all { selected[it.id] != null },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(16.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = PrimaryGreen,
                    contentColor = Color.White,
                    disabledContainerColor = Border,
                    disabledContentColor = Muted,
                ),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        stringResource(R.string.add_to_cart),
                        color = Color.White,
                        style = MaterialTheme.typography.labelLarge,
                        maxLines = 1,
                        softWrap = false,
                    )
                    Text(
                        formatPrice(total),
                        color = Color.White.copy(alpha = 0.92f),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        softWrap = false,
                    )
                }
            }
        }
    }
}

private fun defaultChoice(group: GroupDto): String? {
    if (group.type != "SINGLE") return null
    return (group.choices.firstOrNull { it.isDefault } ?: group.choices.firstOrNull())?.id
}
