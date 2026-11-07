import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : (
        <View />
      )}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  busy,
  variant = "primary",
  style,
  accessibilityLabel,
  icon,
}: PrimaryButtonProps) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";
  const isOutline = variant === "outline";

  const backgroundColor = isPrimary
    ? palette.green
    : isSecondary
    ? palette.greenSoft
    : isDanger
    ? palette.danger
    : palette.surface;

  const borderColor = isOutline ? palette.border : isPrimary ? palette.greenDark : "transparent";
  const borderWidth = isOutline ? 1.5 : 0;
  const textColor = isOutline || isSecondary ? palette.greenDark : palette.white;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          opacity: disabled || busy ? 0.6 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={19}
              color={textColor}
              style={styles.buttonIcon}
            />
          ) : null}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function FeedbackPanel({
  title,
  message,
  loading,
  action,
  onAction,
}: {
  title: string;
  message?: string | null;
  loading?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.feedback}>
      {loading ? <ActivityIndicator size="small" color={palette.green} /> : null}
      <Text style={styles.feedbackTitle}>{title}</Text>
      {message ? <Text style={styles.feedbackMessage}>{message}</Text> : null}
      {action && onAction ? (
        <PrimaryButton
          title={action}
          variant="outline"
          onPress={onAction}
          style={{ marginTop: 14, minWidth: 120, alignSelf: "center" }}
        />
      ) : null}
    </View>
  );
}

export function LibraryLoadAlert({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <View accessibilityRole="alert" style={styles.libraryAlert}>
      <View style={styles.libraryAlertHeading}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color={palette.danger} />
        <Text style={styles.libraryAlertTitle}>تعذّر تحميل الكتب</Text>
      </View>
      <Text style={styles.libraryAlertMessage}>{message}</Text>
      <PrimaryButton
        title="إعادة المحاولة"
        onPress={onRetry}
        busy={retrying}
        disabled={retrying}
        variant="secondary"
        style={styles.libraryRetryButton}
      />
    </View>
  );
}

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.pill,
        selected ? styles.pillSelected : styles.pillIdle,
      ]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, alignItems: "flex-end" },
  eyebrow: { color: palette.gold, fontSize: 12, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  headerTitle: { color: palette.ink, fontSize: 26, fontWeight: "800", textAlign: "right", lineHeight: 36 },
  headerSubtitle: { color: palette.muted, fontSize: 14, textAlign: "right", lineHeight: 23, marginTop: 4 },
  sectionRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: "800", textAlign: "right" },
  sectionAction: { color: palette.green, fontSize: 13, fontWeight: "700" },
  button: {
    minHeight: 50,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonIcon: {
    marginHorizontal: 2,
  },
  buttonText: {
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  feedback: {
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: "center",
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  feedbackTitle: { color: palette.ink, fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 8 },
  feedbackMessage: { color: palette.muted, fontSize: 13, textAlign: "center", lineHeight: 21, marginTop: 6 },
  libraryAlert: {
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: radius.card,
    backgroundColor: "#FFF5F1",
    borderWidth: 1,
    borderColor: "#E4B4AA",
  },
  libraryAlertHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  libraryAlertTitle: { color: palette.danger, fontSize: 15, fontWeight: "900", textAlign: "right" },
  libraryAlertMessage: { color: palette.ink, fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 8 },
  libraryRetryButton: { alignSelf: "flex-end", marginTop: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillSelected: { borderColor: palette.green, backgroundColor: palette.green },
  pillIdle: { borderColor: palette.border, backgroundColor: palette.surface },
  pillText: { color: palette.muted, fontWeight: "700", fontSize: 13 },
  pillTextSelected: { color: palette.white },
  metaLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingVertical: 10,
  },
  metaLabel: { color: palette.muted, fontSize: 13 },
  metaValue: { color: palette.ink, fontSize: 13, fontWeight: "700" },
});
