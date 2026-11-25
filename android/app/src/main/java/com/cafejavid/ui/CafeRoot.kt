package com.cafejavid.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.cafejavid.R
import com.cafejavid.data.Session
import com.cafejavid.data.SessionStore
import com.cafejavid.ui.auth.LoginScreen
import com.cafejavid.ui.cart.CartScreen
import com.cafejavid.ui.menu.MenuScreen
import com.cafejavid.ui.menu.ProductScreen
import com.cafejavid.ui.orders.NotificationsScreen
import com.cafejavid.ui.orders.OrdersScreen
import com.cafejavid.ui.orders.ProfileScreen
import com.cafejavid.ui.orders.TrackingScreen
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

private val SoftFadeIn = fadeIn(animationSpec = tween(220))
private val SoftFadeOut = fadeOut(animationSpec = tween(180))

object Routes {
    const val Login = "login"
    const val Menu = "menu"
    const val Orders = "orders"
    const val Profile = "profile"
    const val Product = "product/{id}"
    const val Cart = "cart"
    const val Track = "track/{id}"
    const val Notifications = "notifications"
}

@HiltViewModel
class RootViewModel @Inject constructor(val sessionStore: SessionStore) : ViewModel()

@Composable
fun CafeRoot(openNotifications: Boolean = false, vm: RootViewModel = hiltViewModel()) {
    val session by produceState<Session?>(initialValue = null, vm) {
        vm.sessionStore.session.collect { value = it }
    }
    if (session == null) {
        Text(stringResource(R.string.loading), modifier = Modifier.padding(24.dp))
        return
    }
    val nav = rememberNavController()
    val start = remember {
        if (!session!!.accessToken.isNullOrBlank()) Routes.Menu else Routes.Login
    }
    LaunchedEffect(openNotifications, session?.accessToken) {
        if (openNotifications && !session?.accessToken.isNullOrBlank()) {
            nav.navigate(Routes.Notifications)
        }
    }
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val tabs = route == Routes.Menu || route == Routes.Orders || route == Routes.Profile
    Scaffold(
        containerColor = Background,
        bottomBar = {
            if (tabs) {
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    modifier = Modifier.border(width = 1.dp, color = Border),
                ) {
                    Tab(nav, Routes.Menu, stringResource(R.string.tab_menu), Icons.Outlined.Restaurant, route)
                    Tab(nav, Routes.Orders, stringResource(R.string.tab_orders), Icons.Outlined.ReceiptLong, route)
                    Tab(nav, Routes.Profile, stringResource(R.string.tab_profile), Icons.Outlined.Person, route)
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = start,
            modifier = Modifier.padding(padding),
            enterTransition = { SoftFadeIn },
            exitTransition = { SoftFadeOut },
            popEnterTransition = { SoftFadeIn },
            popExitTransition = { SoftFadeOut },
        ) {
            composable(Routes.Login) {
                LoginScreen(
                    onSuccess = { toCart ->
                        nav.navigate(Routes.Menu) { popUpTo(0) { inclusive = true } }
                        if (toCart) nav.navigate(Routes.Cart)
                    },
                )
            }
            composable(Routes.Menu) {
                MenuScreen(
                    onProduct = { id -> nav.navigate("product/$id") },
                    onCart = { nav.navigate(Routes.Cart) },
                    onNotifications = { nav.navigate(Routes.Notifications) },
                )
            }
            composable(Routes.Notifications) {
                NotificationsScreen(onBack = { nav.popBackStack() })
            }
            composable(Routes.Orders) {
                OrdersScreen(
                    onOpen = { id -> nav.navigate("track/$id") },
                    onLogin = { nav.navigate(Routes.Login) },
                    onReorder = { nav.navigate(Routes.Cart) },
                )
            }
            composable(Routes.Profile) {
                ProfileScreen(
                    onLoggedOut = { nav.navigate(Routes.Login) { popUpTo(0) } },
                    onLogin = { nav.navigate(Routes.Login) },
                )
            }
            composable(Routes.Product, listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                ProductScreen(entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
            }
            composable(Routes.Cart) {
                CartScreen(
                    onBack = { nav.popBackStack() },
                    onNeedLogin = { nav.navigate(Routes.Login) },
                    onOrdered = { id -> nav.navigate("track/$id") { popUpTo(Routes.Menu) } },
                )
            }
            composable(Routes.Track, listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                TrackingScreen(entry.arguments?.getString("id").orEmpty(), onMenu = {
                    nav.navigate(Routes.Menu) { popUpTo(Routes.Menu) { inclusive = true } }
                })
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Tab(
    nav: androidx.navigation.NavHostController,
    route: String,
    label: String,
    icon: ImageVector,
    current: String?,
) {
    NavigationBarItem(
        selected = current == route,
        onClick = {
            nav.navigate(route) {
                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        },
        icon = { Icon(icon, label) },
        label = { Text(label) },
        colors = androidx.compose.material3.NavigationBarItemDefaults.colors(
            selectedIconColor = PrimaryGreen,
            selectedTextColor = PrimaryGreen,
            indicatorColor = PrimaryTint,
            unselectedIconColor = com.cafejavid.ui.theme.Muted,
            unselectedTextColor = com.cafejavid.ui.theme.Muted,
        ),
    )
}
