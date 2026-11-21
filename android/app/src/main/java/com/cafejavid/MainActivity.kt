package com.cafejavid

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.cafejavid.notifications.SystemNotifier
import com.cafejavid.ui.CafeRoot
import com.cafejavid.ui.theme.CafeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val requestNotifications = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* granted or denied — SystemNotifier no-ops without permission */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        maybeRequestNotificationPermission()
        val openNotifications = intent?.getBooleanExtra(
            SystemNotifier.EXTRA_OPEN_NOTIFICATIONS,
            false,
        ) == true
        enableEdgeToEdge()
        setContent {
            CafeTheme {
                CafeRoot(openNotifications = openNotifications)
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) return
        AlertDialog.Builder(this)
            .setTitle(R.string.notif_permission_title)
            .setMessage(R.string.notif_permission_body)
            .setPositiveButton(R.string.notif_permission_allow) { _, _ ->
                requestNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            .setNegativeButton(R.string.notif_permission_later, null)
            .show()
    }
}
