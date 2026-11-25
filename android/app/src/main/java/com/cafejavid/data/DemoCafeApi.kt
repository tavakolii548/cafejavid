package com.cafejavid.data

import com.cafejavid.util.normalizePhone
import com.cafejavid.util.toPersianDigits
import kotlinx.coroutines.delay
import java.time.Instant
import java.util.UUID
import kotlin.math.max

class DemoException(message: String) : Exception(message)

/**
 * In-memory cafe so the demo APK can show every screen without a server.
 * Menu mirrored from https://parsianmenu.ir/shop/CafeJavid (prices in Toman).
 * Any 4-digit code signs the customer in.
 */
class DemoCafeApi : CafeApi {
    private val config = CafeConfig(
        cafeName = "کافه جاوید",
        phone = "02133656911",
        courierPhone = "09120000000",
        address = "بلوار ده‌حقی، نرسیده به بلوار نبرد، کافه جاوید",
        openingHours = "۸ تا ۲۳",
        acceptingOrders = true,
        deliveryFee = 45000,
        packagingFee = 55000,
        minOrder = 150000,
        tableCount = 10,
        onlinePaymentEnabled = false,
        receiptFooter = "نوش جان",
    )

    private var user = UserDto(
        id = "demo-user",
        phone = "09123456789",
        name = "سارا رضایی",
        firstName = "سارا",
        lastName = "رضایی",
        birthDate = "1375/04/12",
        customerCode = "CJ-1001",
    )
    private val passwords = mutableMapOf<String, String>()
    private val profiles = mutableMapOf<String, UserDto>()
    private val addresses = mutableListOf(
        AddressDto(
            id = "addr-home",
            title = "خانه",
            details = "بلوار ده‌حقی، نرسیده به بلوار نبرد",
            lat = 35.6685,
            lng = 51.4662,
        ),
    )
    private val orders = mutableListOf<OrderDto>()
    private val idempotency = mutableMapOf<String, String>()
    private val inbox = mutableListOf(
        ServerNotificationDto(
            id = "demo-notif-campaign",
            title = "تخفیف باشگاه مشتریان",
            body = "با کد DEMO20 تا ۲۰٪ تخفیف بگیر.",
            createdAt = Instant.now().minusSeconds(7200).toString(),
            read = false,
        ),
        ServerNotificationDto(
            id = "demo-notif-hours",
            title = "ساعات کاری",
            body = "کافه جاوید هر روز از ۸ تا ۲۳ پذیرای شماست.",
            createdAt = Instant.now().minusSeconds(86_400).toString(),
            read = true,
        ),
    )
    private var nextNumber = 2001

    init {
        orders += sampleOrder()
        orders += pastOrder()
        profiles[user.phone] = user
        passwords[user.phone] = "1234"
    }

    override suspend fun config(): CafeConfig {
        pause()
        return config
    }

    override suspend fun requestOtp(body: PhoneBody): RetryDto {
        pause()
        if (normalizePhone(body.phone) == null) throw DemoException("شماره موبایل معتبر نیست")
        return RetryDto(60)
    }

    override suspend fun verifyOtp(body: VerifyBody): AuthResponse {
        pause()
        val phone = normalizePhone(body.phone) ?: throw DemoException("شماره موبایل معتبر نیست")
        if (!body.code.matches(Regex("^\\d{4}$"))) throw DemoException("کد واردشده درست نیست")
        user = user.copy(phone = phone)
        return AuthResponse("demo-access", "demo-refresh", user)
    }

    override suspend fun login(body: LoginBody): AuthResponse {
        pause()
        val phone = normalizePhone(body.phone) ?: throw DemoException("شماره موبایل معتبر نیست")
        val password = body.password.trim()
        if (password.length < 4) throw DemoException("رمز عبور حداقل ۴ کاراکتر باشد")
        val saved = passwords[phone]
        if (body.register) {
            if (saved != null) throw DemoException("این شماره قبلاً ثبت‌نام شده؛ وارد شو")
            passwords[phone] = password
        } else {
            if (saved == null) throw DemoException("حسابی با این شماره نیست؛ ثبت‌نام کن")
            if (saved != password) throw DemoException("رمز عبور اشتباه است")
        }
        val first = body.firstName?.trim().orEmpty()
        val last = body.lastName?.trim().orEmpty()
        val birth = body.birthDate?.trim().orEmpty()
        val fullName = listOf(first, last).filter { it.isNotBlank() }.joinToString(" ").ifBlank { null }
        val existing = profiles[phone]
        user = (existing ?: UserDto(id = "user-$phone", phone = phone)).copy(
            phone = phone,
            firstName = if (body.register) first.ifBlank { null } else first.ifBlank { existing?.firstName },
            lastName = if (body.register) last.ifBlank { null } else last.ifBlank { existing?.lastName },
            birthDate = if (body.register) birth.ifBlank { null } else birth.ifBlank { existing?.birthDate },
            name = if (body.register) fullName else fullName ?: existing?.name,
            customerCode = existing?.customerCode
                ?: if (body.register) "CJ-${1000 + profiles.size + 1}" else null,
        )
        profiles[phone] = user
        return AuthResponse("demo-access", "demo-refresh", user)
    }

    override suspend fun refresh(body: RefreshBody): AuthResponse {
        if (body.refreshToken != "demo-refresh") throw DemoException("نشست شما منقضی شده است")
        return AuthResponse("demo-access", "demo-refresh", user)
    }

    override suspend fun logout(body: RefreshBody) = Unit

    override suspend fun menu(): MenuResponse {
        pause()
        return MenuResponse(categories = categories(), featured = products().find { it.featured })
    }

    override suspend fun me(): UserDto = user

    override suspend fun updateMe(body: NameBody): UserDto {
        val first = body.firstName?.trim().orEmpty()
        val last = body.lastName?.trim().orEmpty()
        val birth = body.birthDate?.trim().orEmpty()
        val composed = body.name?.trim().orEmpty().ifBlank {
            listOf(first, last).filter { it.isNotBlank() }.joinToString(" ")
        }
        user = user.copy(
            name = composed.ifBlank { user.name },
            firstName = if (body.firstName != null) first.ifBlank { null } else user.firstName,
            lastName = if (body.lastName != null) last.ifBlank { null } else user.lastName,
            birthDate = if (body.birthDate != null) birth.ifBlank { null } else user.birthDate,
        )
        profiles[user.phone] = user
        return user
    }

    override suspend fun addresses(): List<AddressDto> = addresses.toList()

    override suspend fun createAddress(body: AddressDto): AddressDto {
        val saved = body.copy(id = "addr-${UUID.randomUUID()}")
        addresses += saved
        return saved
    }

    override suspend fun updateAddress(id: String, body: AddressDto): AddressDto {
        val index = addresses.indexOfFirst { it.id == id }
        if (index < 0) throw DemoException("آدرس پیدا نشد")
        val saved = body.copy(id = id)
        addresses[index] = saved
        return saved
    }

    override suspend fun deleteAddress(id: String) {
        addresses.removeAll { it.id == id }
    }

    override suspend fun validateDiscount(body: ValidateDiscountBody): ValidateDiscountResult {
        pause()
        val result = demoDiscount(body.code, body.subtotal)
        return ValidateDiscountResult(
            code = result.first,
            type = "PERCENT",
            value = 20,
            discountAmount = result.second,
            subtotal = body.subtotal,
            totalAfterDiscount = max(0, body.subtotal - result.second),
        )
    }

    override suspend fun createOrder(key: String, body: CreateOrderBody): OrderDto {
        pause()
        idempotency[key]?.let { id -> return order(id) }
        if (!config.acceptingOrders) throw DemoException("الان سفارش نمی‌گیریم")
        if (body.items.isEmpty()) throw DemoException("سبد خرید خالی است")
        if (body.fulfillment != "DELIVERY") {
            throw DemoException("فقط ارسال با پیک فعال است")
        }
        if (body.addressId.isNullOrBlank() && body.address == null) {
            throw DemoException("آدرس را انتخاب کنید")
        }
        val catalog = products()
        val items = body.items.map { item ->
            val product = catalog.find { it.id == item.productId } ?: throw DemoException("یکی از آیتم‌ها در دسترس نیست")
            if (product.isUnavailable()) {
                throw DemoException(
                    if (product.soldOut) "یکی از آیتم‌ها تموم شده است"
                    else "یکی از آیتم‌ها خارج از زمان سرویس‌دهی است",
                )
            }
            val choices = product.optionGroups.flatMap { group -> group.choices.map { group to it } }
            val selected = item.choiceIds.map { id ->
                choices.find { it.second.id == id } ?: throw DemoException("گزینه‌های انتخاب‌شده معتبر نیست")
            }
            product.optionGroups.filter { it.required && it.type == "SINGLE" }.forEach { group ->
                if (selected.none { it.first.id == group.id }) throw DemoException("گزینه‌های انتخاب‌شده معتبر نیست")
            }
            val unit = product.price + selected.sumOf { it.second.priceDelta }
            OrderItemDto(
                id = UUID.randomUUID().toString(),
                productId = product.id,
                productName = product.name,
                unitPrice = unit,
                quantity = item.quantity,
                options = selected.map { (group, choice) ->
                    OptionSnap(choice.id, group.name, choice.name, choice.priceDelta)
                },
                note = item.note,
                lineTotal = unit * item.quantity,
            )
        }
        val subtotal = items.sumOf { it.lineTotal }
        if (subtotal < config.minOrder) throw DemoException("مبلغ سفارش از حداقل کمتر است")
        val delivery = config.deliveryFee
        val packaging = if (items.isNotEmpty()) config.packagingFee else 0
        val discount = if (!body.discountCode.isNullOrBlank()) demoDiscount(body.discountCode, subtotal) else null
        val discountAmount = discount?.second ?: 0
        val created = OrderDto(
            id = "ord-${UUID.randomUUID()}",
            number = nextNumber++,
            status = "NEW",
            fulfillment = "DELIVERY",
            tableNumber = null,
            customerNote = body.note,
            subtotal = subtotal,
            deliveryFee = delivery,
            packagingFee = packaging,
            discountAmount = discountAmount,
            discountCode = discount?.first,
            total = max(0, subtotal - discountAmount + delivery + packaging),
            paymentMethod = body.paymentMethod,
            paymentStatus = "PENDING",
            estimatedMinutes = 25,
            createdAt = Instant.now().toString(),
            items = items,
        )
        orders.add(0, created)
        idempotency[key] = created.id
        return created
    }

    private fun demoDiscount(raw: String, subtotal: Int): Pair<String, Int> {
        val code = raw.trim().uppercase().replace("\\s+".toRegex(), "")
        if (code != "SARA20" && code != "DEMO20") throw DemoException("کد تخفیف پیدا نشد")
        if (subtotal < 200000) throw DemoException("مبلغ سفارش از حداقل این کد کمتر است")
        val amount = minOf(subtotal / 5, 100000)
        return code to amount
    }

    override suspend fun myOrders(): List<OrderDto> = orders.map { advance(it) }.also { fresh ->
        fresh.forEachIndexed { index, order -> orders[index] = order }
    }

    override suspend fun order(id: String): OrderDto {
        val index = orders.indexOfFirst { it.id == id }
        if (index < 0) throw DemoException("سفارش پیدا نشد")
        val fresh = advance(orders[index])
        orders[index] = fresh
        return fresh
    }

    override suspend fun cancel(id: String, body: CancelBody): OrderDto {
        val current = order(id)
        if (current.status != "NEW") throw DemoException("این سفارش دیگر قابل لغو نیست")
        val updated = current.copy(status = "CANCELLED", cancelReason = body.reason)
        orders[orders.indexOfFirst { it.id == id }] = updated
        return updated
    }

    override suspend fun reorder(id: String): ReorderPreview {
        val current = order(id)
        val catalog = products()
        val items = mutableListOf<ReorderItem>()
        val unavailable = mutableListOf<UnavailableItem>()
        current.items.forEach { item ->
            val product = catalog.find { it.id == item.productId }
            if (product == null || product.soldOut) {
                unavailable += UnavailableItem(item.productName, "در دسترس نیست")
            } else if (product.isOutsideHoursBlocked()) {
                unavailable += UnavailableItem(item.productName, "خارج از زمان سرویس‌دهی")
            } else {
                items += ReorderItem(
                    productId = product.id,
                    name = product.name,
                    quantity = item.quantity,
                    choiceIds = item.options.map { it.choiceId },
                    note = item.note,
                    unitPrice = item.unitPrice,
                    optionSummary = item.options.joinToString(" · ") { it.choiceName },
                )
            }
        }
        return ReorderPreview(items, unavailable)
    }

    override suspend fun myNotifications(): List<ServerNotificationDto> = inbox.toList()

    override suspend fun markNotificationsRead(): OkDto {
        for (i in inbox.indices) {
            inbox[i] = inbox[i].copy(read = true)
        }
        return OkDto(ok = true)
    }

    private fun advance(order: OrderDto): OrderDto {
        if (order.number < 2000 || order.status == "CANCELLED" || order.status == "DELIVERED") return order
        val age = max(0, Instant.now().epochSecond - Instant.parse(order.createdAt).epochSecond)
        val status = when {
            age < 8 -> "NEW"
            age < 16 -> "PREPARING"
            age < 24 -> "READY"
            order.fulfillment == "DELIVERY" && age < 32 -> "OUT_FOR_DELIVERY"
            else -> "DELIVERED"
        }
        return order.copy(status = status)
    }

    private fun sampleOrder(): OrderDto {
        val latte = line("p-1000004", "لته", 270000, 1, emptyList())
        val ice = line("p-1010001", "آیس آمریکانو", 190000, 1, emptyList())
        val cap = line("p-1000007", "کاپوچینو/کورتادو", 250000, 1, emptyList())
        // number < 2000 so advance() leaves it alone — stays NEW for cancel UI testing
        return OrderDto(
            id = "ord-sample",
            number = 1248,
            status = "NEW",
            fulfillment = "DELIVERY",
            subtotal = 710000,
            deliveryFee = 45000,
            packagingFee = 55000,
            total = 810000,
            paymentMethod = "CASH",
            paymentStatus = "PENDING",
            estimatedMinutes = 25,
            createdAt = Instant.now().toString(),
            items = listOf(latte, ice, cap),
        )
    }

    private fun pastOrder(): OrderDto {
        val cake = line("p-1060002", "چیز کیک سن‌سباستین", 325000, 1, emptyList())
        return OrderDto(
            id = "ord-past",
            number = 1240,
            status = "DELIVERED",
            fulfillment = "DELIVERY",
            subtotal = 325000,
            deliveryFee = 0,
            total = 325000,
            paymentMethod = "CASH",
            paymentStatus = "PAID",
            estimatedMinutes = 25,
            createdAt = Instant.now().minusSeconds(86_400).toString(),
            items = listOf(cake),
        )
    }

    private fun line(productId: String, name: String, unit: Int, qty: Int, options: List<OptionSnap>) = OrderItemDto(
        id = "item-$productId",
        productId = productId,
        productName = name,
        unitPrice = unit,
        quantity = qty,
        options = options,
        lineTotal = unit * qty,
    )

    private suspend fun pause() = delay(250)

    private fun categories(): List<CategoryDto> {
        val all = products()
        return categoryDefs.map { (id, name) ->
            CategoryDto(id, name, all.filter { it.categoryId == id })
        }
    }

    private val categoryDefs = listOf(
        "cat-100" to "اسپرسو بار و نوشیدنی گرم",
        "cat-101" to "اسپرسو بار سرد",
        "cat-102" to "چای و دمنوش",
        "cat-103" to "ماکتیل",
        "cat-104" to "اسموتی‌ها",
        "cat-105" to "شیک",
        "cat-106" to "کیک و دسر",
        "cat-108" to "صبحانه و میان‌وعده",
    )

    private fun products(): List<ProductDto> = listOf(
        // اسپرسو بار و نوشیدنی گرم
        product("p-1000001", "cat-100", "اسپرسو(100)", "اسپرسو دبل شات (۱۰۰٪ روبوستا)", 150000, img("1000001.jpg")),
        product("p-1000002", "cat-100", "اسپرسو(70/30)", "اسپرسو دبل‌شات (۷۰٪ روبوستا / ۳۰٪ عربیکا)", 170000, img("1000002.jpg")),
        product("p-1000003", "cat-100", "آمریکانو/بلک", "", 190000),
        product(
            "p-1000004", "cat-100", "لته", "اسپرسو (۳۰٪ عربیکا) + شیر", 270000, img("1000004.jpg"),
            groups = listOf(
                GroupDto(
                    id = "milk",
                    name = "نوع شیر",
                    type = "SINGLE",
                    required = true,
                    choices = listOf(
                        ChoiceDto(id = "milk-regular", name = "شیر معمولی", priceDelta = 0, isDefault = true),
                        ChoiceDto(id = "milk-oat", name = "شیر جو دوسر", priceDelta = 30000),
                        ChoiceDto(id = "milk-almond", name = "شیر بادام", priceDelta = 35000),
                    ),
                ),
            ),
        ),
        product("p-1000005", "cat-100", "موکا", "اسپرسو (۳۰٪ عربیکا) + شیر + شکلات", 290000, img("1000005.png"), combo = true),
        product("p-1000006", "cat-100", "کارامل ماکیاتو", "اسپرسو (۳۰٪ عربیکا) + شیر + کارامل", 290000, combo = true),
        product("p-1000007", "cat-100", "کاپوچینو/کورتادو", "کاپوچینو: اسپرسو ۳۰/۷۰، شیر، فوم — کورتادو: اسپرسو ۳۰/۷۰، شیر (۱:۱)", 250000, img("1000007.jpg")),
        product("p-1000008", "cat-100", "هات چاکلت", "", 280000),
        product("p-1000009", "cat-100", "شوکو پینات", "اسپرسو (۳۰٪ عربیکا) + شیر + کره بادام‌زمینی، شکلات، پودر کاکائو", 450000, img("1000009.png"), featured = true),
        product("p-1000010", "cat-100", "لته لوتوس", "اسپرسو (۳۰٪ عربیکا) + شیر + کرم بیسکوئیت لوتوس", 350000, img("1000010.jpg")),
        product("p-1000011", "cat-100", "ماسالا", "", 250000),
        product("p-1000012", "cat-100", "چای کرک", "", 250000),
        product("p-1000013", "cat-100", "لته با سیروپ دلخواه", "", 290000),
        product("p-1000014", "cat-100", "ماسالا رژیمی", "", 270000),
        product("p-1000015", "cat-100", "اسپرسو (۱۰۰ عربیکا)", "", 230000),
        product("p-1000016", "cat-100", "بون بون", "اسپرسو ۳۰/۷۰، شیر + عسل طبیعی", 295000, img("1000016.png")),

        // اسپرسو بار سرد
        product("p-1010001", "cat-101", "آیس آمریکانو", "", 190000, img("1010001.png"), serviceStartHour = 12, serviceEndHour = 22),
        product("p-1010002", "cat-101", "آیس لته", "", 270000, serviceStartHour = 12, serviceEndHour = 22),
        product("p-1010003", "cat-101", "آیس موکا", "", 290000, img("1010003.png"), outsideServiceHours = true),
        product("p-1010004", "cat-101", "آیس کارامل ماکیاتو", "", 290000),
        product("p-1010005", "cat-101", "اورنج اسپرسو", "اسپرسو ۳۰/۷۰، آب پرتقال تازه", 270000, img("1010005.png")),
        product("p-1010006", "cat-101", "آفوگاتو", "بستنی وانیلی، اسپرسو ۳۰/۷۰", 310000),
        product("p-1010007", "cat-101", "کن پانا", "", 300000),
        product("p-1010008", "cat-101", "پام اسپرسو", "اسپرسو دوبل + آب انار + رب انار", 295000, img("1010008.png")),

        // چای و دمنوش
        product("p-1020001", "cat-102", "چای سیاه", "چای ایرانی + نبات + گل محمدی و دارچین", 90000, img("1020001.jpg")),
        product("p-1020002", "cat-102", "چای سبز", "", 250000),
        product("p-1020003", "cat-102", "دمنوش آرامش", "", 250000),
        product("p-1020004", "cat-102", "دمنوش سرماخوردگی", "", 250000),
        product("p-1020005", "cat-102", "دمنوش فصل", "", 250000),

        // ماکتیل
        product("p-1030001", "cat-103", "لیموناد", "", 390000, img("1030001.png")),
        product("p-1030002", "cat-103", "موهیتو", "", 395000, img("1030002.png")),
        product("p-1030003", "cat-103", "پینکی", "", 350000, img("1030003.png")),
        product("p-1030004", "cat-103", "بلوکولادا", "", 370000, img("1030004.png")),
        product("p-1030005", "cat-103", "رد جوس", "آب آلبالو + آب زرشک + سودا", 340000, img("1030005.png")),

        // اسموتی‌ها
        product("p-1040001", "cat-104", "اسموتی هونولولو", "", 330000),
        product("p-1040002", "cat-104", "اسموتی دربند", "", 380000),

        // شیک
        product("p-1050001", "cat-105", "شیک شکلات", "", 380000, img("1050001.jpg")),
        product("p-1050002", "cat-105", "شیک پینات", "", 370000, img("1050002.jpg")),
        product("p-1050003", "cat-105", "شیک بیسکوئیت", "", 370000),
        product("p-1050004", "cat-105", "شیک نوتلا", "", 370000, img("1050004.jpg")),

        // کیک و دسر
        product("p-1060002", "cat-106", "چیز کیک سن‌سباستین", "", 325000, img("1060002.jpg"), soldOut = true),
        product("p-1060010", "cat-106", "دسر تیرامیسو", "بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو", 325000, img("1060010.jpg")),
        product("p-1060011", "cat-106", "کیک شکلاتی", "", 315000),
        product("p-1060013", "cat-106", "کوکی کاکائویی (طرح قهوه)", "کوکی کاکائویی", 25000, img("1060013.jpg")),
        product("p-1060016", "cat-106", "کوکی رژیمی", "آرد رژیمی + شکر قهوه‌ای + تکه‌های کاکائو", 150000, img("1060016.jpg")),
        product("p-1060019", "cat-106", "کروسان شکلاتی", "کروسان با فیلینگ کاکائو", 250000, img("1060019.jpg")),
        product("p-1060021", "cat-106", "تیرامیسو تک‌نفره", "بیسکوئیت لیدی‌فینگر + پنیر خامه‌ای + اسپرسو + پودر کاکائو", 225000, img("1060021.jpg")),

        // صبحانه و میان‌وعده
        product("p-1080001", "cat-108", "تست ژامبون پنیر", "", 250000, serviceStartHour = 7, serviceEndHour = 11),
        product("p-1080002", "cat-108", "تست پنیر گردو", "", 130000, serviceStartHour = 7, serviceEndHour = 11),
        product("p-1080003", "cat-108", "تست بادام‌زمینی", "", 200000, serviceStartHour = 7, serviceEndHour = 11),
        product("p-1080004", "cat-108", "تست بادام‌زمینی شکلات", "", 230000),
        product("p-1080005", "cat-108", "تست ژامبون گوشت", "", 230000),
        product("p-1080006", "cat-108", "تست ژامبون مرغ", "", 200000),
    )

    private fun img(file: String) = "https://parsianmenu.ir/Shop/203304106156/Product/$file"

    private fun product(
        id: String,
        categoryId: String,
        name: String,
        description: String,
        price: Int,
        imageUrl: String? = null,
        featured: Boolean = false,
        combo: Boolean = false,
        soldOut: Boolean = false,
        serviceStartHour: Int? = null,
        serviceEndHour: Int? = null,
        outsideServiceHours: Boolean? = null,
        groups: List<GroupDto> = emptyList(),
    ) = ProductDto(
        id = id,
        categoryId = categoryId,
        name = toPersianDigits(name),
        description = toPersianDigits(description),
        price = price,
        imageUrl = imageUrl,
        featured = featured,
        combo = combo,
        soldOut = soldOut,
        serviceStartHour = serviceStartHour,
        serviceEndHour = serviceEndHour,
        outsideServiceHours = outsideServiceHours,
        optionGroups = groups.map { it.copy(id = "$id-${it.id}") }.map { group ->
            group.copy(
                name = toPersianDigits(group.name),
                choices = group.choices.map {
                    it.copy(id = "$id-${it.id}", name = toPersianDigits(it.name))
                },
            )
        },
    )

}
