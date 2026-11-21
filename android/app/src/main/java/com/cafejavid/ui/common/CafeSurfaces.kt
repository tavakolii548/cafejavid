package com.cafejavid.ui.common

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cafejavid.ui.theme.Border
import com.cafejavid.ui.theme.Ink
import com.cafejavid.ui.theme.Muted
import com.cafejavid.ui.theme.PrimaryGreen
import com.cafejavid.ui.theme.PrimaryTint
import com.cafejavid.ui.theme.RadiusCard
import com.cafejavid.ui.theme.RadiusLg
import com.cafejavid.ui.theme.SpaceMd
import com.cafejavid.ui.theme.SpaceSm

@Composable
fun CafeSurface(
    modifier: Modifier = Modifier,
    shape: RoundedCornerShape = RoundedCornerShape(RadiusCard),
    elevated: Boolean = false,
    tint: Color = Color.White,
    contentPadding: Dp = 14.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .then(
                if (elevated) {
                    Modifier.shadow(
                        elevation = 10.dp,
                        shape = shape,
                        ambientColor = PrimaryGreen.copy(alpha = 0.08f),
                        spotColor = PrimaryGreen.copy(alpha = 0.12f),
                    )
                } else {
                    Modifier
                },
            )
            .clip(shape)
            .background(tint)
            .border(1.dp, Border, shape)
            .padding(contentPadding),
        content = content,
    )
}

@Composable
fun CafeEmptyState(
    icon: ImageVector,
    title: String,
    hint: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier
                .size(92.dp)
                .clip(CircleShape)
                .background(PrimaryTint),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(SpaceMd))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, color = Ink)
        if (!hint.isNullOrBlank()) {
            Spacer(Modifier.height(SpaceSm))
            Text(
                hint,
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun CafeStatusChip(
    text: String,
    modifier: Modifier = Modifier,
    tone: Color = PrimaryGreen,
) {
    Text(
        text,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(tone.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        color = tone,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
fun Modifier.cafeScreenEnter(delayMillis: Int = 0): Modifier {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        visible = true
    }
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(380, delayMillis = delayMillis, easing = FastOutSlowInEasing),
        label = "screenEnterAlpha",
    )
    val offset by animateFloatAsState(
        targetValue = if (visible) 0f else 22f,
        animationSpec = tween(420, delayMillis = delayMillis, easing = FastOutSlowInEasing),
        label = "screenEnterOffset",
    )
    return this.graphicsLayer {
        this.alpha = alpha
        translationY = offset
    }
}

@Composable
fun PulseDot(
    color: Color = PrimaryGreen,
    size: Dp = 8.dp,
) {
    val transition = rememberInfiniteTransition(label = "pulse")
    val scale by transition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseScale",
    )
    val alpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseAlpha",
    )
    Box(
        Modifier
            .size(size)
            .scale(scale)
            .alpha(alpha)
            .background(color, CircleShape),
    )
}

@Composable
fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
) {
    Text(
        text,
        modifier = modifier.padding(bottom = 2.dp),
        style = if (muted) MaterialTheme.typography.bodySmall else MaterialTheme.typography.titleMedium,
        color = if (muted) Muted else Ink,
    )
}

val SoftCardShape = RoundedCornerShape(RadiusCard)
val SoftFieldShape = RoundedCornerShape(RadiusLg)
