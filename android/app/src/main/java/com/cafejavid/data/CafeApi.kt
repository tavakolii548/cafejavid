package com.cafejavid.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface CafeApi {
    @GET("api/v1/config")
    suspend fun config(): CafeConfig

    @POST("api/v1/auth/otp/request")
    suspend fun requestOtp(@Body body: PhoneBody): RetryDto

    @POST("api/v1/auth/otp/verify")
    suspend fun verifyOtp(@Body body: VerifyBody): AuthResponse

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginBody): AuthResponse

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body body: RefreshBody): AuthResponse

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body body: RefreshBody)

    @GET("api/v1/menu")
    suspend fun menu(): MenuResponse

    @GET("api/v1/me")
    suspend fun me(): UserDto

    @PUT("api/v1/me")
    suspend fun updateMe(@Body body: NameBody): UserDto

    @GET("api/v1/me/addresses")
    suspend fun addresses(): List<AddressDto>

    @POST("api/v1/me/addresses")
    suspend fun createAddress(@Body body: AddressDto): AddressDto

    @PUT("api/v1/me/addresses/{id}")
    suspend fun updateAddress(@Path("id") id: String, @Body body: AddressDto): AddressDto

    @DELETE("api/v1/me/addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: String)

    @POST("api/v1/cart/validate-discount")
    suspend fun validateDiscount(@Body body: ValidateDiscountBody): ValidateDiscountResult

    @POST("api/v1/orders")
    suspend fun createOrder(
        @Header("Idempotency-Key") key: String,
        @Body body: CreateOrderBody,
    ): OrderDto

    @GET("api/v1/orders")
    suspend fun myOrders(): List<OrderDto>

    @GET("api/v1/orders/{id}")
    suspend fun order(@Path("id") id: String): OrderDto

    @POST("api/v1/orders/{id}/cancel")
    suspend fun cancel(@Path("id") id: String, @Body body: CancelBody): OrderDto

    @POST("api/v1/orders/{id}/reorder-preview")
    suspend fun reorder(@Path("id") id: String): ReorderPreview

    @GET("api/v1/me/notifications")
    suspend fun myNotifications(): List<ServerNotificationDto>

    @POST("api/v1/me/notifications/read")
    suspend fun markNotificationsRead(): OkDto
}
