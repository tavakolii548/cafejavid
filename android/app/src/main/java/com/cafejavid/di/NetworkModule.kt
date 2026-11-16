package com.cafejavid.di

import com.cafejavid.BuildConfig
import com.cafejavid.data.ApiErrorBody
import com.cafejavid.data.AuthResponse
import com.cafejavid.data.CafeApi
import com.cafejavid.data.DemoCafeApi
import com.cafejavid.data.DemoException
import com.cafejavid.data.RefreshBody
import com.cafejavid.data.SessionStore
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.HttpException
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

val appJson: Json = Json { ignoreUnknownKeys = true; explicitNulls = false }

fun Throwable.apiMessage(): String? {
    if (this is DemoException) return message
    val http = this as? HttpException ?: return null
    val raw = http.response()?.errorBody()?.string() ?: return null
    return runCatching { appJson.decodeFromString<ApiErrorBody>(raw).error?.message }.getOrNull()
}

class AuthInterceptor(private val session: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { session.session.first().accessToken }
        val request = if (token.isNullOrBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        }
        return chain.proceed(request)
    }
}

class TokenAuthenticator(private val session: SessionStore) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        val refresh = runBlocking { session.session.first().refreshToken } ?: return null
        val payload = appJson.encodeToString(RefreshBody.serializer(), RefreshBody(refresh))
        val request = Request.Builder()
            .url(BuildConfig.API_BASE + "api/v1/auth/refresh")
            .post(okhttp3.RequestBody.create("application/json".toMediaType(), payload))
            .build()
        OkHttpClient().newCall(request).execute().use { refreshed ->
            if (!refreshed.isSuccessful) {
                runBlocking { session.clear() }
                return null
            }
            val body = refreshed.body?.string() ?: return null
            val parsed = appJson.decodeFromString(AuthResponse.serializer(), body)
            runBlocking { session.saveAuth(parsed) }
            return response.request.newBuilder()
                .header("Authorization", "Bearer ${parsed.accessToken}")
                .build()
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count += 1
            prior = prior.priorResponse
        }
        return count
    }
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun client(session: SessionStore): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .addInterceptor(AuthInterceptor(session))
        .authenticator(TokenAuthenticator(session))
        .build()

    @Provides
    @Singleton
    fun retrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE)
        .client(client)
        .addConverterFactory(appJson.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun api(retrofit: Retrofit): CafeApi =
        if (BuildConfig.DEMO_MODE) DemoCafeApi() else retrofit.create(CafeApi::class.java)
}
