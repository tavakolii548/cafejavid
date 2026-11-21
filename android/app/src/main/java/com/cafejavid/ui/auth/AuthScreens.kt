package com.cafejavid.ui.auth

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusEvent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cafejavid.R
import com.cafejavid.data.CafeApi
import com.cafejavid.data.CheckoutGate
import com.cafejavid.data.LoginBody
import com.cafejavid.data.NotificationStore
import com.cafejavid.data.SessionStore
import com.cafejavid.data.WelcomeGate
import com.cafejavid.di.apiMessage
import com.cafejavid.notifications.NotificationSyncScheduler
import com.cafejavid.ui.common.JalaliBirthDateDialog
import com.cafejavid.ui.common.SoftFieldShape
import com.cafejavid.ui.common.cafeScreenEnter
import com.cafejavid.ui.theme.Accent
import com.cafejavid.ui.theme.Background
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.CafeButton
import com.cafejavid.ui.theme.CafeOutlinedButton
import com.cafejavid.ui.theme.Danger
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.util.normalizePhone
import com.cafejavid.util.toEnglishDigits
import com.cafejavid.util.toPersianDigits
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginState(
    val cafeName: String = "",
    val phone: String = "",
    val password: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val birthDate: String = "",
    val isRegister: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val api: CafeApi,
    private val session: SessionStore,
    private val gate: CheckoutGate,
    private val welcome: WelcomeGate,
    private val notifications: NotificationStore,
) : ViewModel() {
    private val _state = MutableStateFlow(LoginState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { api.config() }.onSuccess { config ->
                _state.update { it.copy(cafeName = config.cafeName) }
            }
        }
    }

    fun onPhone(value: String) {
        val english = toEnglishDigits(value).filter { it.isDigit() }.take(11)
        _state.update { it.copy(phone = english, error = null) }
    }

    fun onPassword(value: String) {
        _state.update { it.copy(password = value.take(32), error = null) }
    }

    fun onFirstName(value: String) = _state.update { it.copy(firstName = value.take(40), error = null) }
    fun onLastName(value: String) = _state.update { it.copy(lastName = value.take(40), error = null) }

    fun onBirthDate(value: String) {
        _state.update { it.copy(birthDate = value, error = null) }
    }

    fun showRegisterForm() {
        _state.update { it.copy(isRegister = true, error = null) }
    }

    fun showLoginForm() {
        _state.update {
            it.copy(
                isRegister = false,
                firstName = "",
                lastName = "",
                birthDate = "",
                error = null,
            )
        }
    }

    fun submit(register: Boolean, onSuccess: (Boolean) -> Unit, networkError: String) {
        if (register && !_state.value.isRegister) {
            showRegisterForm()
            return
        }
        val phone = normalizePhone(_state.value.phone) ?: return
        val password = _state.value.password.trim()
        if (password.length < 4) {
            _state.update { it.copy(error = "رمز عبور حداقل ۴ کاراکتر باشد") }
            return
        }
        val current = _state.value
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            runCatching {
                api.login(
                    LoginBody(
                        phone = phone,
                        password = password,
                        register = register,
                        firstName = if (register) current.firstName.trim().ifBlank { null } else null,
                        lastName = if (register) current.lastName.trim().ifBlank { null } else null,
                        birthDate = if (register) current.birthDate.trim().ifBlank { null } else null,
                    ),
                )
            }.onSuccess { response ->
                session.saveAuth(response)
                NotificationSyncScheduler.ensurePeriodic(appContext)
                NotificationSyncScheduler.enqueueNow(appContext)
                runCatching { api.myNotifications() }
                    .onSuccess { notifications.mergeServer(it) }
                val displayName = response.user.name
                    ?: listOfNotNull(response.user.firstName, response.user.lastName)
                        .joinToString(" ")
                        .ifBlank { null }
                welcome.prepareMessage(displayName)
                notifications.maybePushBirthday(response.user.birthDate, displayName)
                val pending = gate.pending
                gate.pending = false
                onSuccess(pending)
            }.onFailure { error ->
                _state.update { it.copy(error = error.apiMessage() ?: networkError) }
            }
            _state.update { it.copy(loading = false) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LoginScreen(onSuccess: (Boolean) -> Unit, vm: LoginViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val network = stringResource(R.string.error_network)
    val canSubmit = normalizePhone(state.phone) != null && state.password.length >= 4 && !state.loading
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    var showBirthPicker by remember { mutableStateOf(false) }

    fun bringFocusedIntoView(requester: BringIntoViewRequester) {
        scope.launch {
            delay(120)
            requester.bringIntoView()
            scrollState.scrollBy(with(density) { 24.dp.toPx() })
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Background)
            .imePadding()
            .navigationBarsPadding(),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(236.dp)
                .clip(RoundedCornerShape(bottomStart = 40.dp, bottomEnd = 40.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF163A2C), PrimaryGreen, Color(0xFF2A6B4F)),
                    ),
                ),
        ) {
            Box(
                Modifier
                    .size(160.dp)
                    .align(Alignment.TopStart)
                    .offset(x = (-40).dp, y = (-48).dp)
                    .background(Color.White.copy(alpha = 0.08f), CircleShape),
            )
            Box(
                Modifier
                    .size(120.dp)
                    .align(Alignment.BottomEnd)
                    .offset(x = 36.dp, y = 40.dp)
                    .background(Accent.copy(alpha = 0.18f), CircleShape),
            )
            Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    Modifier
                        .size(100.dp)
                        .shadow(12.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.18f))
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.14f))
                        .padding(14.dp),
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
                    state.cafeName.ifBlank { stringResource(R.string.app_name) },
                    color = Color.White,
                    style = MaterialTheme.typography.headlineSmall,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    if (state.isRegister) stringResource(R.string.register_subtitle) else stringResource(R.string.login_subtitle),
                    color = Color.White.copy(alpha = 0.78f),
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 28.dp),
                )
            }
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .cafeScreenEnter()
                .padding(horizontal = 22.dp, vertical = 22.dp),
        ) {
            Text(
                if (state.isRegister) stringResource(R.string.register_action) else stringResource(R.string.login_title),
                style = MaterialTheme.typography.headlineSmall,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (state.isRegister) {
                    stringResource(R.string.register_subtitle)
                } else {
                    stringResource(R.string.login_subtitle)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
            )
            Spacer(Modifier.height(18.dp))

            val phoneBring = remember { BringIntoViewRequester() }
            Text(stringResource(R.string.phone_label), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(8.dp))
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .clip(SoftFieldShape)
                        .background(Color.White)
                        .border(1.dp, Border, SoftFieldShape)
                        .bringIntoViewRequester(phoneBring)
                        .onFocusEvent { if (it.isFocused) bringFocusedIntoView(phoneBring) }
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.country_chip),
                        modifier = Modifier
                            .background(PrimaryTint, RoundedCornerShape(12.dp))
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        color = PrimaryGreen,
                        style = MaterialTheme.typography.labelMedium,
                    )
                    BasicTextField(
                        value = toPersianDigits(state.phone),
                        onValueChange = vm::onPhone,
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(textAlign = TextAlign.Left, color = Ink),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        cursorBrush = SolidColor(PrimaryGreen),
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            val passwordBring = remember { BringIntoViewRequester() }
            Text(stringResource(R.string.password_label), style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(8.dp))
            BasicTextField(
                value = state.password,
                onValueChange = vm::onPassword,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(SoftFieldShape)
                    .background(Color.White)
                    .border(1.dp, Border, SoftFieldShape)
                    .bringIntoViewRequester(passwordBring)
                    .onFocusEvent { if (it.isFocused) bringFocusedIntoView(passwordBring) }
                    .padding(horizontal = 16.dp, vertical = 18.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = Ink),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                cursorBrush = SolidColor(PrimaryGreen),
                decorationBox = { inner ->
                    if (state.password.isEmpty()) Text(stringResource(R.string.password_hint), color = Muted)
                    inner()
                },
            )

            AnimatedVisibility(
                visible = state.isRegister,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically(),
            ) {
                Column {
                    Spacer(Modifier.height(14.dp))
                    Text(stringResource(R.string.optional_profile), style = MaterialTheme.typography.bodySmall, color = Muted)
                    Spacer(Modifier.height(10.dp))

                    val firstBring = remember { BringIntoViewRequester() }
                    Text(stringResource(R.string.first_name), style = MaterialTheme.typography.bodySmall, color = Muted)
                    Spacer(Modifier.height(6.dp))
                    BasicTextField(
                        value = state.firstName,
                        onValueChange = vm::onFirstName,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(SoftFieldShape)
                            .background(Color.White)
                            .border(1.dp, Border, SoftFieldShape)
                            .bringIntoViewRequester(firstBring)
                            .onFocusEvent { if (it.isFocused) bringFocusedIntoView(firstBring) }
                            .padding(horizontal = 16.dp, vertical = 18.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = Ink),
                        singleLine = true,
                        cursorBrush = SolidColor(PrimaryGreen),
                        decorationBox = { inner ->
                            if (state.firstName.isEmpty()) Text(stringResource(R.string.first_name_hint), color = Muted)
                            inner()
                        },
                    )

                    Spacer(Modifier.height(12.dp))
                    val lastBring = remember { BringIntoViewRequester() }
                    Text(stringResource(R.string.last_name), style = MaterialTheme.typography.bodySmall, color = Muted)
                    Spacer(Modifier.height(6.dp))
                    BasicTextField(
                        value = state.lastName,
                        onValueChange = vm::onLastName,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(SoftFieldShape)
                            .background(Color.White)
                            .border(1.dp, Border, SoftFieldShape)
                            .bringIntoViewRequester(lastBring)
                            .onFocusEvent { if (it.isFocused) bringFocusedIntoView(lastBring) }
                            .padding(horizontal = 16.dp, vertical = 18.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = Ink),
                        singleLine = true,
                        cursorBrush = SolidColor(PrimaryGreen),
                        decorationBox = { inner ->
                            if (state.lastName.isEmpty()) Text(stringResource(R.string.last_name_hint), color = Muted)
                            inner()
                        },
                    )

                    Spacer(Modifier.height(12.dp))
                    Text(stringResource(R.string.birth_date), style = MaterialTheme.typography.bodySmall, color = Muted)
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(SoftFieldShape)
                            .background(Color.White)
                            .border(1.dp, Border, SoftFieldShape)
                            .clickable { showBirthPicker = true }
                            .padding(horizontal = 16.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (state.birthDate.isEmpty()) {
                            Text(stringResource(R.string.birth_date_hint), color = Muted)
                        } else {
                            Text(toPersianDigits(state.birthDate), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            state.error?.let {
                Text(it, color = Danger, modifier = Modifier.padding(top = 10.dp), style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(20.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CafeButton(
                    text = stringResource(R.string.login_action),
                    onClick = { vm.submit(register = false, onSuccess = onSuccess, networkError = network) },
                    enabled = canSubmit,
                    modifier = Modifier.weight(1f).height(54.dp),
                )
                if (state.isRegister) {
                    CafeButton(
                        text = stringResource(R.string.register_submit),
                        onClick = { vm.submit(register = true, onSuccess = onSuccess, networkError = network) },
                        enabled = canSubmit,
                        modifier = Modifier.weight(1f).height(54.dp),
                    )
                } else {
                    CafeOutlinedButton(
                        text = stringResource(R.string.register_action),
                        onClick = { vm.showRegisterForm() },
                        enabled = !state.loading,
                        modifier = Modifier.weight(1f).height(54.dp),
                    )
                }
            }
            if (state.isRegister) {
                Spacer(Modifier.height(14.dp))
                Text(
                    "حساب داری؟ برگشت به ورود",
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !state.loading, onClick = vm::showLoginForm)
                        .padding(vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PrimaryGreen,
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(Modifier.height(48.dp))
        }
    }

    if (showBirthPicker) {
        JalaliBirthDateDialog(
            initial = state.birthDate,
            onDismiss = { showBirthPicker = false },
            onConfirm = { picked ->
                vm.onBirthDate(picked)
                showBirthPicker = false
            },
        )
    }

    if (state.loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = PrimaryGreen)
        }
    }
}
