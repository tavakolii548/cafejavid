package com.cafejavid.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
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
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.CafeButton
import com.cafejavid.ui.theme.CafeOutlinedButton
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.util.normalizePhone
import com.cafejavid.util.toEnglishDigits
import com.cafejavid.util.toPersianDigits
import dagger.hilt.android.lifecycle.HiltViewModel
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
        val cleaned = toEnglishDigits(value).filter { it.isDigit() || it == '/' }.take(10)
        _state.update { it.copy(birthDate = cleaned, error = null) }
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

@Composable
fun LoginScreen(onSuccess: (Boolean) -> Unit, vm: LoginViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val network = stringResource(R.string.error_network)
    val canSubmit = normalizePhone(state.phone) != null && state.password.length >= 4 && !state.loading
    Column(Modifier.fillMaxSize().background(Color(0xFFF4F6F2))) {
        Column(
            Modifier.fillMaxWidth().height(220.dp).background(PrimaryGreen, RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp)),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.12f))
                    .padding(12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(R.drawable.cafe_logo),
                    contentDescription = stringResource(R.string.cd_logo),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(state.cafeName.ifBlank { stringResource(R.string.app_name) }, color = Color.White, style = MaterialTheme.typography.headlineSmall)
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
        ) {
            Text(
                if (state.isRegister) stringResource(R.string.register_action) else stringResource(R.string.login_title),
                style = MaterialTheme.typography.headlineSmall,
            )
            Spacer(Modifier.height(8.dp))
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
            Text(stringResource(R.string.phone_label), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .border(1.dp, Border, RoundedCornerShape(16.dp))
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.country_chip),
                        modifier = Modifier.background(PrimaryTint, RoundedCornerShape(12.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
                        color = PrimaryGreen,
                    )
                    BasicTextField(
                        value = toPersianDigits(state.phone),
                        onValueChange = vm::onPhone,
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(textAlign = TextAlign.Left),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        cursorBrush = SolidColor(PrimaryGreen),
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Text(stringResource(R.string.password_label), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
            BasicTextField(
                value = state.password,
                onValueChange = vm::onPassword,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 18.dp),
                textStyle = MaterialTheme.typography.bodyMedium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                cursorBrush = SolidColor(PrimaryGreen),
                decorationBox = { inner ->
                    if (state.password.isEmpty()) Text(stringResource(R.string.password_hint), color = Muted)
                    inner()
                },
            )
            if (state.isRegister) {
                Spacer(Modifier.height(14.dp))
                Text(stringResource(R.string.optional_profile), style = MaterialTheme.typography.bodySmall, color = Muted)
                Spacer(Modifier.height(10.dp))
                Text(stringResource(R.string.first_name), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(6.dp))
                BasicTextField(
                    value = state.firstName,
                    onValueChange = vm::onFirstName,
                    modifier = Modifier.fillMaxWidth().height(56.dp).border(1.dp, Border, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 18.dp),
                    textStyle = MaterialTheme.typography.bodyMedium,
                    singleLine = true,
                    cursorBrush = SolidColor(PrimaryGreen),
                    decorationBox = { inner ->
                        if (state.firstName.isEmpty()) Text(stringResource(R.string.first_name_hint), color = Muted)
                        inner()
                    },
                )
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.last_name), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(6.dp))
                BasicTextField(
                    value = state.lastName,
                    onValueChange = vm::onLastName,
                    modifier = Modifier.fillMaxWidth().height(56.dp).border(1.dp, Border, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 18.dp),
                    textStyle = MaterialTheme.typography.bodyMedium,
                    singleLine = true,
                    cursorBrush = SolidColor(PrimaryGreen),
                    decorationBox = { inner ->
                        if (state.lastName.isEmpty()) Text(stringResource(R.string.last_name_hint), color = Muted)
                        inner()
                    },
                )
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.birth_date), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(6.dp))
                BasicTextField(
                    value = toPersianDigits(state.birthDate),
                    onValueChange = vm::onBirthDate,
                    modifier = Modifier.fillMaxWidth().height(56.dp).border(1.dp, Border, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 18.dp),
                    textStyle = MaterialTheme.typography.bodyMedium,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    cursorBrush = SolidColor(PrimaryGreen),
                    decorationBox = { inner ->
                        if (state.birthDate.isEmpty()) Text(stringResource(R.string.birth_date_hint), color = Muted)
                        inner()
                    },
                )
            }
            state.error?.let { Text(it, color = PrimaryGreen, modifier = Modifier.padding(top = 8.dp)) }
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
            Spacer(Modifier.height(12.dp))
        }
    }
    if (state.loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = PrimaryGreen) }
    }
}
