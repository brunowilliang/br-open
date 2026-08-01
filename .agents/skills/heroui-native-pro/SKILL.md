---
name: heroui-native-pro
description: "HeroUI Pro Native component library for React Native. Use when building mobile UIs with heroui-native-pro — date pickers, steppers, progress buttons, slide buttons, number fields, radio groups. Teaches compound component patterns, Native Pro MCP tool usage, Uniwind styling, and Reanimated conventions. Keywords: HeroUI Native Pro, heroui-native-pro, Pro Native components, Native Pro MCP, React Native, Uniwind."
metadata:
  author: heroui
  version: "1.0.0"
---

# HeroUI Pro Native Development Guide

`heroui-native-pro` is a premium React Native component library built on **Uniwind (Tailwind CSS for React Native)** and **React Native Reanimated**. It extends `heroui-native` (the OSS base) with advanced date & time, form, navigation, and button components for mobile apps.

## Skills Teach, MCP Does

This skill teaches your agent **how** to write HeroUI Native code correctly. For **live data** (component docs, theme variables, guides), use the **HeroUI Native Pro MCP server** (`heroui-native-pro` at `native-mcp.heroui.pro`).

The Pro Native MCP is a **unified server** — it covers both `heroui-native-pro` (Pro) and `heroui-native` (OSS). You do NOT need a separate OSS MCP installed.

| Tool                  | When to use                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `list_components`     | Discover all components — both `heroui-native-pro` and `heroui-native` in one call           |
| `get_component_docs`  | Get compound API, anatomy, props, examples for any Pro or OSS native component               |
| `get_docs`            | Read installation, provider, theming, styling, composition, animation docs for both packages |
| `get_theme_variables` | Get OSS native theme tokens (semantic colors, typography, spacing)                           |

**Always call `list_components` first to get the up-to-date component list, then `get_component_docs` before implementing.** The categories listed in this skill are a reference snapshot — new components are added regularly. The MCP `list_components` tool always returns the current list. If a component name is not in the MCP response, it does not exist yet. Never guess or hallucinate component names.

---

## Two Packages, One MCP

| Package             | What it contains                                                          |
| ------------------- | ------------------------------------------------------------------------- |
| `heroui-native`     | Base components: Button, Card, TextField, Switch, Accordion, Dialog, etc. |
| `heroui-native-pro` | Pro components: advanced date/time, forms, navigation, Pro buttons        |

Both packages are served by the single `heroui-native-pro` MCP. Import from the correct package:

```tsx
import {Button, Card, TextField, Switch} from "heroui-native";
import {Stepper, DatePicker, ProgressButton, SlideButton} from "heroui-native-pro";
```

---

## CRITICAL: Native Only — Do Not Use Web Patterns

**This guide is for HeroUI Native Pro ONLY.** Do NOT apply `@heroui/react` or `@heroui-pro/react` (web) patterns.

| Feature   | Web (`@heroui-pro/react`)            | Native (`heroui-native-pro`)             |
| --------- | ------------------------------------ | ---------------------------------------- |
| Styling   | Tailwind CSS v4                      | Uniwind (Tailwind CSS for React Native)  |
| Colors    | `oklch()` CSS variables              | `hsl()` / `oklch()` via Uniwind `@theme` |
| Events    | `onPress` (Button), `onClick` (HTML) | `onPress` for all interactive elements   |
| Layout    | `<div>`                              | `<View>` from `react-native`             |
| Scrolling | `overflow-*` Tailwind                | `<ScrollView>` / `<FlatList>`            |
| Animation | CSS transitions / Motion             | React Native Reanimated (worklets)       |
| Package   | `@heroui-pro/react`                  | `heroui-native-pro`                      |

Never import CSS files in a React Native screen. Never use raw HTML tags. Never use `onClick`.

### WRONG — web leakage

```tsx
// DO NOT DO THIS — web-only
import { Stepper } from "@heroui-pro/react";
import "./styles.css";

<div className="flex">
  <Stepper onClick={...} />
</div>;
```

### CORRECT — Native Pro

```tsx
import {View} from "react-native";
import {Stepper} from "heroui-native-pro";

<View className="bg-background flex-1 p-4">
  <Stepper onValueChange={setStep}>{/* … */}</Stepper>
</View>;
```

---

## Critical Setup Rules

- **Tailwind CSS v4 via Uniwind** — plain `tailwindcss` does not work in React Native
- **`HeroUINativeProvider` required** — wrap your app root (from `heroui-native`)
- **`GestureHandlerRootView` required** — wrap everything (from `react-native-gesture-handler`)
- **Compound components** — always use dot notation (`Stepper.Step`, `DatePicker.Trigger`, `Calendar.Grid`)
- **`onPress` not `onClick`** — React Native has no click events
- **`asChild` for polymorphism** — swap inner element without breaking compound API
- **Scan both OSS and Pro with `@source`** — Pro classes won't apply otherwise

Minimal `global.css`:

```css
@import "tailwindcss";
@import "uniwind";
@import "heroui-native/styles";

@source "./node_modules/heroui-native/lib";
@source "./node_modules/heroui-native-pro/lib";
```

Minimal layout:

```tsx
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {HeroUINativeProvider} from "heroui-native";
import "./global.css";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <HeroUINativeProvider>{/* app */}</HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
```

---

## Pro Component Categories

> This list is a snapshot of **Pro** components for reference. Always call `list_components` via the MCP to get the current list — it returns both Pro and OSS components in a single sectioned response. New components are added regularly. Component names are **kebab-case** in MCP calls and **PascalCase** on import.

### Buttons

`progress-button` (ProgressButton), `slide-button` (SlideButton), `social-auth-button` (SocialAuthButton)

### Date and Time

`calendar` (Calendar), `date-field` (DateField), `date-picker` (DatePicker), `date-range-picker` (DateRangePicker), `range-calendar` (RangeCalendar)

### Forms

`number-field` (NumberField), `number-stepper` (NumberStepper), `radio-button-group` (RadioButtonGroup)

### Navigation

`stepper` (Stepper), `split-view` (SplitView)

### Feedback

`trend-chip` (TrendChip)

---

## Key Rules

- Import from `"heroui-native"` for base components, `"heroui-native-pro"` for Pro
- Subcomponents via **dot notation**: `Stepper.Step`, `DatePicker.Trigger`, `Calendar.Grid.Cell`
- Use `onPress` everywhere, never `onClick`
- Use `className` (Uniwind) — it works on `View`, `Text`, and all HeroUI components
- Layout containers are `<View>` from `react-native`, text is `<Text>`
- Date components require `@internationalized/date` — the Pro CLI installs it automatically on `npx heroui-pro install`
- Use `asChild` when you need a different trigger element without losing behavior/a11y:

```tsx
<DatePicker>
  <DatePicker.Select>
    <DatePicker.Trigger asChild>
      <Button variant="tertiary">
        <Button.Label>Pick a date</Button.Label>
      </Button>
    </DatePicker.Trigger>
  </DatePicker.Select>
</DatePicker>
```

### Semantic Variants (shared with OSS)

- Button / Pro buttons: `variant="primary"` (default), `"secondary"`, `"tertiary"`, `"outline"`, `"ghost"`, `"danger"`, `"danger-soft"`
- Sizes: `size="sm"`, `"md"` (default), `"lg"`
- States: `isDisabled`, `isPending`, `isIconOnly`

### Stepper (v1 anatomy)

Always use the full compound anatomy — flattening into props won't work:

```tsx
import {Stepper} from "heroui-native-pro";

<Stepper>
  <Stepper.Step>
    <Stepper.Rail>
      <Stepper.Indicator>
        <Stepper.IndicatorCheck />
        <Stepper.IndicatorNumber />
      </Stepper.Indicator>
      <Stepper.Separator>
        <Stepper.SeparatorTrack />
        <Stepper.SeparatorFill />
      </Stepper.Separator>
    </Stepper.Rail>
    <Stepper.Content>
      <Stepper.Title>Account</Stepper.Title>
      <Stepper.Description>Create your account</Stepper.Description>
    </Stepper.Content>
  </Stepper.Step>
</Stepper>;
```

---

## Design Tokens

HeroUI Native Pro uses the exact same token system as `heroui-native`. Use semantic Uniwind classes, not raw colors:

- Backgrounds: `bg-background`, `bg-surface`, `bg-surface-secondary`, `bg-overlay`
- Text: `text-foreground`, `text-muted`
- Brand: `bg-accent`, `text-accent-foreground`
- Status: `text-success`, `text-warning`, `text-danger` (each with `-foreground`)
- Borders: `border-border`, `border-separator`

All colors live in `global.css` under `@theme` with `@variant light` / `@variant dark` for automatic light/dark switching. Override any token there and every OSS + Pro component follows.

```css
@layer theme {
  @variant light {
    --accent: oklch(0.65 0.25 270);
  }
  @variant dark {
    --accent: oklch(0.65 0.25 270);
  }
}
```

Use `get_theme_variables` via the MCP to read the current token list instead of guessing.

---

## Animation

Pro components use **React Native Reanimated** under the hood (worklets, shared values, layout animations). Don't try to animate them with CSS transitions or Framer Motion.

- Use Reanimated APIs (`useSharedValue`, `withSpring`, `Animated.View`) for your own animations
- Respect `reduceMotion` — it's honored by all Pro components automatically
- For custom animations on a Pro slot, pass `asChild` and render an `Animated.View`

---

## Components That DONT EXIST — NEVER Use

- `Divider` — use `Separator` from `heroui-native`
- Web-only imports (`@heroui/react`, `@heroui-pro/react`) — wrong package for React Native
- `CardHeader` / `CardContent` / `CardFooter` as top-level imports — use dot notation `Card.Header`, `Card.Content`, `Card.Footer`
- `useHistory`, `Link` from React Router — use `expo-router` or `react-navigation` instead

## Past Corrections (ALWAYS follow these)

- Compound anatomy is not optional — flattening Stepper/DatePicker/Calendar into props silently breaks a11y and animations
- Use `asChild` to swap a Trigger/Indicator into a `heroui-native` `Button` — don't re-implement the button yourself
- Wrap scrollable content in `<ScrollView>` or `<FlatList>`; Pro components do not add their own scroll containers
- Always wrap the app in `GestureHandlerRootView` before `HeroUINativeProvider`, not after
- Always add both `@source` lines in `global.css` (`heroui-native/lib` and `heroui-native-pro/lib`) or Pro classes will be stripped
- For CI/CD, set `HEROUI_AUTH_TOKEN` (not the personal token) so the postinstall can download Pro artifacts
- Prefer `heroui-native` built-in primitives (Button, TextField, Switch, Dialog, BottomSheet) over hand-rolled `Pressable` + styles
