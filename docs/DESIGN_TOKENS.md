# Design tokens

Shared by the Android Compose theme and the admin Tailwind theme. Source: product prompt section 3. Screenshots override spacing when they disagree.

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| background | `#F4F6F2` | Screen background |
| surface | `#FFFFFF` | Cards |
| border | `#DDE4DE` | Card and field borders |
| ink | `#17251E` | Primary text, dark buttons |
| muted | `#5B6B62` | Secondary text |
| primary | `#1E4D3A` | Green actions, header |
| primaryTint | `#E3EDE6` | Selected chips, tinted tiles |
| accent | `#F2B55A` | Badges; always with ink text |
| tileSand | `#FBEBCF` | Alternate tile |
| tileLilac | `#EDE6F2` | Alternate tile |

## Shape and spacing

- Screen horizontal padding: 20dp (login 24dp)
- Cards: radius 18dp, 1dp border, white
- Buttons: radius 16dp, height 52–56dp
- Icon buttons: 44×44dp, radius 14dp
- Chips: height 40dp, radius 20dp
- Minimum touch target: 44dp
- Product tile image: 68dp, radius 14dp
- Featured card radius: 22dp
- Login header: 260dp, bottom radius 36dp
- Product hero image: 140dp, radius 24dp

## Type (Vazirmatn)

- Title 22sp bold
- Section 16sp bold
- Body 14sp
- Caption 12sp muted
- Button 15–16sp bold

## Rules

- Persian digits for every displayed number and price.
- Prices stored as integers in Toman.
- No emoji. Icons are outlined / stroke style.
- Accent (`#F2B55A`) never uses white text.
