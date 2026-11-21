package com.cafejavid

import android.app.Application
import com.cafejavid.notifications.NotificationForegroundSync
import com.cafejavid.notifications.NotificationSyncScheduler
import com.cafejavid.notifications.SystemNotifier
import dagger.hilt.android.HiltAndroidApp
import org.osmdroid.config.Configuration
import java.io.File
import javax.inject.Inject

@HiltAndroidApp
class CafeApplication : Application() {
    @Inject lateinit var systemNotifier: SystemNotifier
    @Inject lateinit var notificationForegroundSync: NotificationForegroundSync

    override fun onCreate() {
        super.onCreate()
        val config = Configuration.getInstance()
        config.load(this, getSharedPreferences("osmdroid", MODE_PRIVATE))
        config.userAgentValue = packageName
        config.osmdroidBasePath = File(cacheDir, "osmdroid")
        config.osmdroidTileCache = File(cacheDir, "tiles")
        systemNotifier.ensureChannel()
        NotificationSyncScheduler.ensurePeriodic(this)
        NotificationSyncScheduler.enqueueNow(this)
        notificationForegroundSync.start()
    }
}
