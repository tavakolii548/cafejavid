package com.cafejavid.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class CafeConfig(
    val cafeName: String = "",
    val phone: String = "",
    val address: String = "",
    val openingHours: String = "",
    val acceptingOrders: Boolean = true,
    val deliveryFee: Int = 0,
    val packagingFee: Int = 0,
    val minOrder: Int = 0,
    val tableCount: Int = 0,
    val onlinePaymentEnabled: Boolean = false,
    val receiptFooter: String = "",
)

@Serializable
data class PhoneBody(val phone: String)

@Serializable
data class VerifyBody(val phone: String, val code: String)

@Serializable
data class LoginBody(
    val phone: String,
    val password: String,
    val register: Boolean = false,
    val firstName: String? = null,
    val lastName: String? = null,
    val birthDate: String? = null,
)

@Serializable
data class RefreshBody(val refreshToken: String)

@Serializable
data class RetryDto(val retryAfterSeconds: Int = 60)

@Serializable
data class UserDto(
    val id: String,
    val phone: String,
    val name: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val birthDate: String? = null,
    val customerCode: String? = null,
)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto,
)

@Serializable
data class ServerNotificationDto(
    val id: String,
    val title: String,
    val body: String,
    val createdAt: String,
    val read: Boolean = false,
)

@Serializable
data class OkDto(val ok: Boolean = true)

@Serializable
data class NameBody(
    val name: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val birthDate: String? = null,
)

@Serializable
data class AddressDto(
    val id: String = "",
    val title: String = "",
    val details: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
)

@Serializable
data class ChoiceDto(
    val id: String,
    val name: String,
    val priceDelta: Int = 0,
    val isDefault: Boolean = false,
)

@Serializable
data class GroupDto(
    val id: String,
    val name: String,
    val type: String,
    val required: Boolean = false,
    val choices: List<ChoiceDto> = emptyList(),
)

@Serializable
data class ProductDto(
    val id: String,
    val categoryId: String,
    val name: String,
    val description: String = "",
    val price: Int,
    val imageUrl: String? = null,
    val featured: Boolean = false,
    val soldOut: Boolean = false,
    val serviceStartHour: Int? = null,
    val serviceEndHour: Int? = null,
    /** When non-null, prefer server-computed flag over local hour math. */
    val outsideServiceHours: Boolean? = null,
    val optionGroups: List<GroupDto> = emptyList(),
)

/** Sold out or outside service hours (server flag preferred when present). */
fun ProductDto.isUnavailable(): Boolean {
    if (soldOut) return true
    return outsideServiceHours ?: com.cafejavid.util.isOutsideServiceHours(serviceStartHour, serviceEndHour)
}

fun ProductDto.isOutsideHoursBlocked(): Boolean =
    !soldOut && (outsideServiceHours ?: com.cafejavid.util.isOutsideServiceHours(serviceStartHour, serviceEndHour))

@Serializable
data class CategoryDto(
    val id: String,
    val name: String,
    val products: List<ProductDto> = emptyList(),
)

@Serializable
data class MenuResponse(
    val categories: List<CategoryDto> = emptyList(),
    val featured: ProductDto? = null,
)

@Serializable
data class OptionSnap(
    val choiceId: String = "",
    val groupName: String = "",
    val choiceName: String = "",
    val priceDelta: Int = 0,
)

@Serializable
data class OrderItemDto(
    val id: String = "",
    val productId: String = "",
    val productName: String = "",
    val unitPrice: Int = 0,
    val quantity: Int = 1,
    val options: List<OptionSnap> = emptyList(),
    val note: String? = null,
    val lineTotal: Int = 0,
)

@Serializable
data class OrderDto(
    val id: String,
    val number: Int = 0,
    val status: String = "",
    val fulfillment: String = "",
    val tableNumber: Int? = null,
    val addressSnapshot: JsonElement? = null,
    val customerNote: String? = null,
    val subtotal: Int = 0,
    val deliveryFee: Int = 0,
    val packagingFee: Int = 0,
    val discountAmount: Int = 0,
    val discountCode: String? = null,
    val total: Int = 0,
    val paymentMethod: String = "",
    val paymentStatus: String = "",
    val cancelReason: String? = null,
    val estimatedMinutes: Int? = null,
    val createdAt: String = "",
    val items: List<OrderItemDto> = emptyList(),
)

@Serializable
data class CreateItemBody(
    val productId: String,
    val quantity: Int,
    val choiceIds: List<String>,
    val note: String? = null,
)

@Serializable
data class InlineAddressBody(
    val title: String,
    val details: String,
    val lat: Double,
    val lng: Double,
)

@Serializable
data class CreateOrderBody(
    val fulfillment: String,
    val tableNumber: Int? = null,
    val addressId: String? = null,
    val address: InlineAddressBody? = null,
    val paymentMethod: String,
    val note: String? = null,
    val discountCode: String? = null,
    val items: List<CreateItemBody>,
)

@Serializable
data class ValidateDiscountBody(
    val code: String,
    val subtotal: Int,
)

@Serializable
data class ValidateDiscountResult(
    val code: String,
    val type: String = "",
    val value: Int = 0,
    val discountAmount: Int = 0,
    val subtotal: Int = 0,
    val totalAfterDiscount: Int = 0,
)

@Serializable
data class CancelBody(val reason: String? = null)

@Serializable
data class ReorderItem(
    val productId: String,
    val name: String = "",
    val quantity: Int = 1,
    val choiceIds: List<String> = emptyList(),
    val note: String? = null,
    val unitPrice: Int = 0,
    val optionSummary: String = "",
)

@Serializable
data class ReorderPreview(
    val items: List<ReorderItem> = emptyList(),
    val unavailable: List<UnavailableItem> = emptyList(),
)

@Serializable
data class UnavailableItem(val productName: String = "", val reason: String = "")

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail? = null)

@Serializable
data class ApiErrorDetail(val code: String = "", val message: String = "")

@Serializable
data class CartLine(
    val localId: String,
    val productId: String,
    val name: String,
    val quantity: Int,
    val choiceIds: List<String>,
    val optionSummary: String,
    val unitPrice: Int,
    val note: String? = null,
)
