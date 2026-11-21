package com.cafejavid.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cafejavid.data.CafeApi
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.SessionStore
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first

class NotificationSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val entry = EntryPointAccessors.fromApplication(
            applicationContext,
            Entry::class.java,
        )
        val token = entry.sessionStore().session.first().accessToken
        if (token.isNullOrBlank()) return Result.success()
        return runCatching {
            val items = entry.api().myNotifications()
            entry.notificationStore().mergeServer(items)
            Result.success()
        }.getOrElse {
            Result.retry()
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface Entry {
        fun api(): CafeApi
        fun sessionStore(): SessionStore
        fun notificationStore(): NotificationStore
    }
}
