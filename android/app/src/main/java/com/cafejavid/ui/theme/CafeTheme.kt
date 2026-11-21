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
val Danger = Color(0xFFB42318)
val SurfaceSoft = Color(0xFFF8FAF7)

val SpaceXs = 6.dp
val SpaceSm = 8.dp
val SpaceMd = 14.dp
val SpaceLg = 20.dp
val SpaceXl = 28.dp

val RadiusSm = 12.dp
val RadiusMd = 14.dp
val RadiusLg = 16.dp
val RadiusCard = 18.dp
val RadiusHero = 24.dp

val Vazir = FontFamily(
    Font(R.font.vazirmatn_regular, FontWeight.Normal),
    Font(R.font.vazirmatn_medium, FontWeight.Medium),
    Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

private val CafeTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        color = Ink,
    ),
    headlineSmall = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 30.sp,
        color = Ink,
    ),
    titleLarge = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 26.sp,
        color = Ink,
    ),
    titleMedium = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        color = Ink,
    ),
    bodyLarge = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 24.sp,
        color = Ink,
    ),
    bodyMedium = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 22.sp,
        color = Ink,
    ),
    bodySmall = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 18.sp,
        color = Muted,
    ),
    labelLarge = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = Vazir,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
)

@Composable
fun CafeTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = lightColorScheme(
                primary = PrimaryGreen,
                onPrimary = Color.White,
                secondary = Accent,
                onSecondary = Ink,
                background = Background,
                surface = Color.White,
                surfaceVariant = PrimaryTint,
                onBackground = Ink,
                onSurface = Ink,
                outline = Border,
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
        shape = RoundedCornerShape(RadiusLg),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (dark) Ink else PrimaryGreen,
            contentColor = Color.White,
            disabledContainerColor = Border,
            disabledContentColor = Muted,
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 0.dp,
            pressedElevation = 0.dp,
            disabledElevation = 0.dp,
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
        shape = RoundedCornerShape(RadiusLg),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = Ink,
            disabledContentColor = Muted,
        ),
    ) {
        androidx.compose.material3.Text(text, color = if (enabled) Ink else Muted, style = MaterialTheme.typography.labelLarge)
    }
}
