package com.cafejavid.ui.theme

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cafejavid.R

val Ink = Color(0xFF17251E)
val Muted = Color(0xFF5B6B62)
val PrimaryGreen = Color(0xFF1E4D3A)
val PrimaryTint = Color(0xFFE3EDE6)
val Accent = Color(0xFFF2B55A)
val Border = Color(0xFFDDE4DE)
val Background = Color(0xFFF4F6F2)
val Sand = Color(0xFFFBEBCF)
val Lilac = Color(0xFFEDE6F2)

val Vazir = FontFamily(
    Font(R.font.vazirmatn_regular, FontWeight.Normal),
    Font(R.font.vazirmatn_medium, FontWeight.Medium),
    Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

private val CafeTypography = Typography(
    headlineSmall = TextStyle(fontFamily = Vazir, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Ink),
    titleMedium = TextStyle(fontFamily = Vazir, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Ink),
    bodyMedium = TextStyle(fontFamily = Vazir, fontWeight = FontWeight.Normal, fontSize = 14.sp, color = Ink),
    bodySmall = TextStyle(fontFamily = Vazir, fontWeight = FontWeight.Normal, fontSize = 12.sp, color = Muted),
    labelLarge = TextStyle(fontFamily = Vazir, fontWeight = FontWeight.Bold, fontSize = 15.sp),
)

@Composable
fun CafeTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = lightColorScheme(
                primary = PrimaryGreen,
                onPrimary = Color.White,
                background = Background,
                surface = Color.White,
                onBackground = Ink,
                onSurface = Ink,
            ),
            typography = CafeTypography,
            content = content,
        )
    }
}

@Composable
fun CafeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    dark: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (dark) Ink else PrimaryGreen,
            contentColor = Color.White,
            disabledContainerColor = Border,
            disabledContentColor = Muted,
        ),
    ) {
        androidx.compose.material3.Text(text, style = MaterialTheme.typography.labelLarge, color = Color.White)
    }
}

@Composable
fun CafeOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        androidx.compose.material3.Text(text, color = Ink, style = MaterialTheme.typography.labelLarge)
    }
}
