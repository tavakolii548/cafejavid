package com.cafejavid.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cafejavid.R
import com.cafejavid.util.formatJalaliDate
import com.cafejavid.util.jalaliMonthLength
import com.cafejavid.util.parseJalaliDate
import com.cafejavid.util.toPersianDigits
import com.cafejavid.util.todayJalaliTehran

val JalaliMonthNames = listOf(
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JalaliBirthDateDialog(
    initial: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    val today = remember { todayJalaliTehran() }
    val minYear = 1300
    val maxYear = today.first
    val years = remember(maxYear) { (maxYear downTo minYear).toList() }

    val parsed = remember(initial) { parseJalaliDate(initial) }
    var year by remember {
        mutableIntStateOf((parsed?.first ?: (maxYear - 25)).coerceIn(minYear, maxYear))
    }
    var month by remember {
        mutableIntStateOf((parsed?.second ?: 1).coerceIn(1, 12))
    }
    var day by remember {
        mutableIntStateOf((parsed?.third ?: 1).coerceAtLeast(1))
    }

    val maxDay = jalaliMonthLength(year, month)
    LaunchedEffect(year, month, maxDay) {
        if (day > maxDay) day = maxDay
    }

    var yearExpanded by remember { mutableStateOf(false) }
    var monthExpanded by remember { mutableStateOf(false) }
    var dayExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.birth_date_pick_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ExposedDropdownMenuBox(
                    expanded = yearExpanded,
                    onExpandedChange = { yearExpanded = it },
                ) {
                    OutlinedTextField(
                        value = toPersianDigits(year.toString()),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.birth_year)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) },
                        modifier = Modifier
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                            .fillMaxWidth(),
                    )
                    ExposedDropdownMenu(
                        expanded = yearExpanded,
                        onDismissRequest = { yearExpanded = false },
                    ) {
                        years.forEach { y ->
                            DropdownMenuItem(
                                text = { Text(toPersianDigits(y.toString())) },
                                onClick = {
                                    year = y
                                    yearExpanded = false
                                },
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(
                    expanded = monthExpanded,
                    onExpandedChange = { monthExpanded = it },
                ) {
                    OutlinedTextField(
                        value = JalaliMonthNames[month - 1],
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.birth_month)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) },
                        modifier = Modifier
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                            .fillMaxWidth(),
                    )
                    ExposedDropdownMenu(
                        expanded = monthExpanded,
                        onDismissRequest = { monthExpanded = false },
                    ) {
                        JalaliMonthNames.forEachIndexed { index, name ->
                            DropdownMenuItem(
                                text = { Text(name) },
                                onClick = {
                                    month = index + 1
                                    monthExpanded = false
                                },
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(
                    expanded = dayExpanded,
                    onExpandedChange = { dayExpanded = it },
                ) {
                    OutlinedTextField(
                        value = toPersianDigits(day.toString()),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.birth_day)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dayExpanded) },
                        modifier = Modifier
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                            .fillMaxWidth(),
                    )
                    ExposedDropdownMenu(
                        expanded = dayExpanded,
                        onDismissRequest = { dayExpanded = false },
                    ) {
                        (1..maxDay).forEach { d ->
                            DropdownMenuItem(
                                text = { Text(toPersianDigits(d.toString())) },
                                onClick = {
                                    day = d
                                    dayExpanded = false
                                },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(formatJalaliDate(year, month, day)) },
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
}
