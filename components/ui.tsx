import React, { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { palette, radius } from "../lib/theme";

type AppScreenProps = { children: ReactNode; style?: StyleProp<ViewStyle>; edges?: Edge[] };

export function AppScreen({ children, style, edges = ["top", "left", "right"] }: AppScreenProps) {
  return <SafeAreaView edges={edges} style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function AppHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={8}><Text style={styles.sectionAction}>{action}</Text></Pressable> : <View />}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
type PrimaryButtonProps = { title: string; onPress?: () => void; disabled?: boolean; busy?: boolean; variant?: ButtonVariant; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };

export function PrimaryButton({ title, onPress, disabled, busy, variant = "primary", style, accessibilityLabel }: PrimaryButtonProps) {
  const variantStyle = variant === "primary" ? styles.button_primary : variant === "secondary" ? styles.button_secondary : variant === "danger" ? styles.button_danger : styles.button_outline;
  const darkText = variant === "secondary" || variant === "outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, variantStyle, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
    >
      {busy ? <ActivityIndicator color={darkText ? palette.green : palette.white} /> : <Text style={[styles.buttonText, darkText && styles.buttonTextDark]}>{title}</Text>}
    </Pressable>
  );
}

export function FeedbackPanel({ title, message, loading, action, onAction }: { title: string; message?: string | null; loading?: boolean; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.feedback}>
      {loading ? <ActivityIndicator size="small" color={palette.green} /> : null}
      <Text style={styles.feedbackTitle}>{title}</Text>
      {message ? <Text style={styles.feedbackMessage}>{message}</Text> : null}
      {action && onAction ? <PrimaryButton title={action} variant="outline" onPress={onAction} style={{ marginTop: 12, alignSelf: "center" }} /> : null}
    </View>
  );
}

export function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, selected ? styles.pillSelected : styles.pillIdle, pressed && { opacity: 0.72 }]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function MetaLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.metaLine}><Text style={styles.metaValue}>{value}</Text><Text style={styles.metaLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, alignItems: "flex-end" },
  eyebrow: { color: palette.gold, fontSize: 12, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  headerTitle: { color: palette.ink, fontSize: 26, fontWeight: "800", textAlign: "right", lineHeight: 36 },
  headerSubtitle: { color: palette.muted, fontSize: 14, textAlign: "right", lineHeight: 23, marginTop: 4 },
  sectionRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: "800", textAlign: "right" },
  sectionAction: { color: palette.green, fontSize: 13, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: radius.control, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 12 },
  button_primary: { backgroundColor: palette.green },
  button_secondary: { backgroundColor: palette.greenSoft },
  button_outline: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  button_danger: { backgroundColor: palette.danger },
  buttonText: { color: palette.white, fontWeight: "800", fontSize: 14, textAlign: "center" },
  buttonTextDark: { color: palette.green },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  feedback: { padding: 24, marginHorizontal: 20, marginTop: 20, alignItems: "center", borderRadius: radius.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  feedbackTitle: { color: palette.ink, fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 8 },
  feedbackMessage: { color: palette.muted, fontSize: 13, textAlign: "center", lineHeight: 21, marginTop: 6 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
  pillSelected: { borderColor: palette.green, backgroundColor: palette.green },
  pillIdle: { borderColor: palette.border, backgroundColor: palette.surface },
  pillText: { color: palette.muted, fontWeight: "700", fontSize: 13 },
  pillTextSelected: { color: palette.white },
  metaLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border, paddingVertical: 10 },
  metaLabel: { color: palette.muted, fontSize: 13 },
  metaValue: { color: palette.ink, fontSize: 13, fontWeight: "700" },
});
