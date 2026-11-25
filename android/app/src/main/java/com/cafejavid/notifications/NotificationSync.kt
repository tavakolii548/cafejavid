package com.cafejavid.notifications

import android.content.Context
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.cafejavid.data.CafeApi
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.SessionStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

object NotificationSyncScheduler {
    private const val UNIQUE_PERIODIC = "cafe_notification_sync"
    private const val UNIQUE_ONCE = "cafe_notification_sync_once"

    fun ensurePeriodic(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<NotificationSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_PERIODIC,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun enqueueNow(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = OneTimeWorkRequestBuilder<NotificationSyncWorker>()
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_ONCE,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}

@Singleton
class NotificationForegroundSync @Inject constructor(
    private val api: CafeApi,
    private val session: SessionStore,
    private val notifications: NotificationStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var started = false
    private var pollJob: Job? = null

    fun start() {
        if (started) return
        started = true
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> {
                        scope.launch { syncQuietly() }
                        pollJob?.cancel()
                        pollJob = scope.launch {
                            while (isActive) {
                                delay(45_000)
                                syncQuietly()
                            }
                        }
                    }
                    Lifecycle.Event.ON_STOP -> {
                        pollJob?.cancel()
                        pollJob = null
                    }
                    else -> Unit
                }
            },
        )
    }

    private suspend fun syncQuietly() {
        val token = session.session.first().accessToken
        if (token.isNullOrBlank()) return
        runCatching {
            notifications.mergeServer(api.myNotifications())
        }
    }
}
