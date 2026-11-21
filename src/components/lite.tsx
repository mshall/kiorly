import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme, radius, MIN_TOUCH } from "@/theme";
import { Badge, Button, Card, Field, Row, Sheet, T } from "@/components/ui";
import { NOTE_MAX } from "@/lite/machine";
import { Icon } from "@/components/Icon";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor, type Product } from "@/api/products";
import { tileByKey, type Tile } from "@/modules/registry";
import { benefitKeys, isLite, lockedTilesFor, openRequestCount, openRequestsFor, requestFeature, roleGroup } from "@/lite/logic";
import { noteTapped, useLastTapped, useUpgradeRequest } from "@/lite/useUpgradeRequest";
import { formatDay } from "@/lib/format";
import { haptic } from "@/lib/haptics";

/** A PRO module shown on a Lite org: visible, clearly locked (lock icon + Pro pill), never a dead end (opens what it does for your role). */
export function LockedTile({ tile, onPress, compact }: { tile: Tile; onPress: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const accent = accentFor(tile.product, scheme);
  const title = t(`tiles.${tile.key}.title`);
  return (
    <Pressable testID={`locked-${tile.key}`} onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button"
      accessibilityLabel={t("lite.tileA11y", { title, desc: t(`tiles.${tile.key}.desc`) })}
      style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, minHeight: compact ? 72 : 112, minWidth: MIN_TOUCH, borderRadius: radius + 2, backgroundColor: pressed ? colors.raised : colors.subtle, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", padding: compact ? 12 : 14, gap: compact ? 8 : 10 })}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: compact ? 32 : 40, height: compact ? 32 : 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={compact ? 18 : 20} color={accent} /></View>
        <Badge tone="ocean" label={t("lite.pro")} />
      </Row>
      <View style={{ gap: 2 }}>
        <T weight="semibold" numberOfLines={compact ? 2 : 1} variant={compact ? "small" : "body"} color={colors.text}>{title}</T>
        {compact ? null : <T variant="caption" muted numberOfLines={2}>{t(`tiles.${tile.key}.desc`)}</T>}
      </View>
    </Pressable>
  );
}

/**
 * The single action: staff ask their admin (goes to the owner), owners/admins request the plan change. States: idle, sending, requested (with date),
 * queued (offline), error. Never blocks; never charges anything.
 */
export function UpgradeRequestButton({ product, featureKey }: { product: Product; featureKey: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { state, request, isAdmin } = useUpgradeRequest(product, featureKey);
  const [note, setNote] = useState("");
  const idleTitle = t(isAdmin ? "lite.cta.upgradePlan" : "lite.cta.askAdmin");
  const date = state.kind === "requested" || state.kind === "queued" ? formatDay(state.at, i18n.language) : "";
  if (state.kind === "requested" || state.kind === "queued") {
    const done = state.kind === "requested";
    return (
      <View style={{ gap: 6 }} testID="upgrade-request-done" accessibilityLiveRegion="polite">
        <Row gap={10} style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: radius, backgroundColor: done ? colors.successSoft : colors.warningSoft, borderWidth: 1, borderColor: done ? colors.success : colors.warning }} accessible accessibilityRole="text"
          accessibilityLabel={done ? t("lite.requestedOn", { date }) : t("lite.queued")}>
          <Icon name={done ? "check" : "clock"} size={20} color={done ? colors.success : colors.warning} />
          <T weight="semibold" style={{ flex: 1 }}>{done ? t("lite.requestedOn", { date }) : t("lite.queued")}</T>
        </Row>
        <T variant="small" muted>{done ? t(isAdmin ? "lite.hint.doneAdmin" : "lite.hint.doneStaff") : t("lite.hint.queued")}</T>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {state.kind === "error" ? <T variant="small" color={colors.danger} testID="upgrade-request-error" accessibilityRole="alert">{t("lite.error")}</T> : null}
      {state.kind === "idle" || state.kind === "error" ? (
        <View style={{ gap: 4 }}>
          <Field testID="upgrade-note" label={t("lite.noteLabel")} placeholder={t("lite.notePlaceholder")} value={note} onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))} maxLength={NOTE_MAX} multiline
            style={{ minHeight: 72, paddingVertical: 10, textAlignVertical: "top" }} accessibilityHint={t("lite.noteCount", { n: note.length, max: NOTE_MAX })} />
          <T variant="caption" muted style={{ alignSelf: "flex-end" }} testID="upgrade-note-count">{t("lite.noteCount", { n: note.length, max: NOTE_MAX })}</T>
        </View>
      ) : null}
      <Button testID="upgrade-request" title={state.kind === "sending" ? t("lite.sending") : state.kind === "error" ? t("lite.retry") : idleTitle} icon={state.kind === "sending" ? undefined : "award"} loading={state.kind === "sending"}
        accessibilityLabel={state.kind === "error" ? t("lite.retry") : idleTitle} onPress={() => void request(note)} />
      {state.kind === "idle" ? <T variant="small" muted>{t(isAdmin ? "lite.hint.admin" : "lite.hint.staff")}</T> : null}
    </View>
  );
}

/** Bottom sheet for a locked feature: what it does for YOUR role, the plan needed, and one request action. Not a blocking modal (swipe / tap outside / close). */
export function UpgradeSheet({ product, featureKey, onClose }: { product: Product; featureKey: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { sessions } = useSessions();
  const b = sessions[product]?.bootstrap;
  const tile = featureKey ? tileByKey(featureKey) : undefined;
  const group = roleGroup(product, b?.user.role, b?.user.isOwner);
  const [roleKey, defKey] = benefitKeys(featureKey ?? "", group);
  const benefit = i18n.exists(roleKey) ? t(roleKey) : t(defKey, { defaultValue: "" });
  const plan = b?.org.plan === "BASIC" ? t("signIn.planBasic") : b?.org.plan ?? "";
  return (
    <Sheet visible={!!tile} onClose={onClose} title={tile ? t(`tiles.${tile.key}.title`) : ""} testID="upgrade-sheet" footer={tile ? <UpgradeRequestButton product={product} featureKey={tile.key} /> : undefined}>
      {tile ? (
        <>
          <Row gap={8} style={{ flexWrap: "wrap" }}><Badge tone="ocean" icon="lock" label={t("lite.pro")} /><Badge tone="muted" label={t(`lite.roles.${group}`)} /></Row>
          <T variant="small" weight="semibold" color={colors.muted}>{t("lite.forYou")}</T>
          <T testID="upgrade-benefit">{benefit}</T>
          <Card style={{ gap: 6, padding: 12 }}>
            <Row gap={8}><Icon name="award" size={18} color={colors.ink} /><T weight="semibold">{t("lite.planNeeded")}</T></Row>
            <T variant="small" muted>{t("lite.planValue", { plan })}</T>
          </Card>
          <Row gap={8} style={{ alignItems: "flex-start" }}><Icon name="shield" size={18} color={colors.success} /><T variant="small" muted style={{ flex: 1 }}>{t("lite.safetyStays")}</T></Row>
          <Pressable onPress={() => { onClose(); router.push(`/upgrade?product=${product}&feature=${tile.key}` as never); }} accessibilityRole="link" accessibilityLabel={t("lite.seeAll")} style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
            <T variant="small" weight="semibold" color={colors.ink2}>{t("lite.seeAll")} →</T>
          </Pressable>
        </>
      ) : null}
    </Sheet>
  );
}

/** Open the sheet and remember the tap (Home card). */
export function useLockedTap(product: Product, setFeature: (k: string) => void) {
  const { sessions } = useSessions();
  return (k: string) => { noteTapped(product, sessions[product]?.email ?? "", k); setFeature(k); };
}

/** "Lite" pill for account rows; owners/admins also see how many staff upgrade requests are open. */
export function LiteBadge({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { sessions } = useSessions();
  const b = sessions[product]?.bootstrap;
  if (!isLite(b)) return null;
  const n = openRequestCount(product, b);
  return (
    <View style={{ alignItems: "flex-end", gap: 4 }} accessible accessibilityLabel={n ? `${t("lite.badge")}. ${t("lite.req.countA11y", { count: n })}` : t("lite.badge")}>
      <Badge testID={`lite-badge-${product}`} tone="ocean" icon="shield" label={t("lite.badge")} />
      {n ? <Badge testID={`lite-badge-count-${product}`} tone="warning" icon="users" label={String(n)} /> : null}
    </View>
  );
}

/** Total open staff upgrade requests across the signed-in Lite products (approvers only): drives the Me tab badge. */
export function useOpenRequestTotal(): number {
  const { sessions, products } = useSessions();
  return products.reduce((n, p) => n + openRequestCount(p, sessions[p]?.bootstrap), 0);
}

/**
 * Owner/admin only (Lite): who asked for what and when. Each row opens the plan page for that feature. The in-app inbox stays Pro-only, so this is where an
 * approver learns about requests. Display name only. A server that sends just the count gets a single count row.
 */
export function UpgradeRequestsSection({ product, limit = 3 }: { product: Product; limit?: number }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { sessions } = useSessions();
  const b = sessions[product]?.bootstrap;
  const items = openRequestsFor(product, b);
  const count = openRequestCount(product, b);
  if (!count) return null;
  const shown = items.slice(0, limit);
  const more = count - shown.length;
  const open = (feature?: string) => router.push(`/upgrade?product=${product}${feature ? `&feature=${feature}` : ""}` as never);
  return (
    <Card style={{ gap: 4, padding: 12 }} testID={`upgrade-requests-${product}`}>
      <Row gap={8} style={{ justifyContent: "space-between", minHeight: 32 }}>
        <T variant="small" weight="semibold" color={colors.muted} accessibilityRole="header" style={{ flex: 1 }}>{t("lite.req.title")}</T>
        <Badge testID={`upgrade-requests-count-${product}`} tone="warning" icon="users" label={String(count)} />
      </Row>
      {shown.length ? shown.map((r) => {
        const feature = requestFeature(r);
        const featureTitle = feature === "general" ? "" : t(`tiles.${feature}.title`);
        const who = r.requesterName || t(`lite.req.role.${roleGroup(product, r.requesterRole)}`);
        const line = feature === "general" ? t("lite.req.askedGeneral", { name: who }) : t("lite.req.asked", { name: who, feature: featureTitle });
        const meta = t("lite.req.meta", { role: t(`lite.req.role.${roleGroup(product, r.requesterRole)}`), date: formatDay(r.requestedAt, i18n.language) });
        return (
          <Pressable key={r.id} testID={`upgrade-request-${r.id}`} onPress={() => { haptic.tap(); open(feature === "general" ? undefined : feature); }} accessibilityRole="button"
            accessibilityLabel={`${line}. ${meta}.${r.note ? ` ${r.note}.` : ""} ${t("lite.req.open")}`}
            style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderRadius: radius, backgroundColor: pressed ? colors.raised : "transparent" })}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Icon name="user" size={18} color={colors.ink2} /></View>
            <View style={{ flex: 1 }}>
              <T weight="medium" numberOfLines={2}>{line}</T>
              <T variant="caption" muted numberOfLines={1}>{meta}</T>
              {r.note ? <T variant="caption" muted numberOfLines={2}>“{r.note}”</T> : null}
            </View>
            <Icon name="chevron" size={16} color={colors.subtleText} mirror />
          </Pressable>
        );
      }) : (
        <Pressable testID={`upgrade-requests-countonly-${product}`} onPress={() => { haptic.tap(); open(); }} accessibilityRole="button" accessibilityLabel={`${t("lite.req.countOnly")}. ${t("lite.req.countA11y", { count })}`}
          style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <T weight="medium" style={{ flex: 1 }}>{t("lite.req.countOnly")}</T><Icon name="chevron" size={16} color={colors.subtleText} mirror />
        </Pressable>
      )}
      {shown.length && more > 0 ? <T variant="caption" muted testID={`upgrade-requests-more-${product}`}>{t("lite.req.more", { count: more })}</T> : null}
      <T variant="caption" muted>{t("lite.req.hint")}</T>
    </Card>
  );
}

/** Home block for a Lite product: a calm upgrade card (shows what you looked at last + request status) and a few locked tiles. No banners, no nagging. */
export function LiteHomeBlock({ product }: { product: Product }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { sessions } = useSessions();
  const s = sessions[product];
  const b = s?.bootstrap;
  const last = useLastTapped();
  const lastKey = last && last.product === product && last.owner === (s?.email ?? "") && tileByKey(last.featureKey) ? last.featureKey : null;
  const locked = lockedTilesFor(product, b);
  const shown = [...locked].sort((a, c) => Number(!!c.quick) - Number(!!a.quick)).slice(0, 4);
  const req = useUpgradeRequest(product, lastKey ?? "general");
  const [feature, setFeature] = useState<string | null>(null);
  const tap = useLockedTap(product, setFeature);
  const planLabel = b?.org.plan === "BASIC" ? t("signIn.planBasic") : (b?.org.plan ?? "");
  const sub = lastKey
    ? req.state.kind === "requested" ? t("lite.homeRequested", { feature: t(`tiles.${lastKey}.title`), date: formatDay(req.state.at, i18n.language) })
      : req.state.kind === "queued" ? t("lite.queued") : t("lite.homeLast", { feature: t(`tiles.${lastKey}.title`) })
    : `${t("home.safetyOnly")} · ${t("home.upgradeCta")}`;
  return (
    <View style={{ gap: 10 }} testID={`lite-home-${product}`}>
      <Card onPress={() => (lastKey ? setFeature(lastKey) : router.push(`/upgrade?product=${product}` as never))} testID={`upgrade-card-${product}`}
        accessibilityLabel={`${t("home.upgradeCard", { product: t(PRODUCT_META[product].nameKey), plan: planLabel })}. ${sub}`} style={{ borderColor: colors.pulse }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.pulseSoft, alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={22} color={colors.pulse} /></View>
          <View style={{ flex: 1 }}>
            <T weight="semibold">{t("home.upgradeCard", { product: t(PRODUCT_META[product].nameKey), plan: planLabel })}</T>
            <T variant="small" muted testID={`upgrade-card-sub-${product}`}>{sub}</T>
          </View>
          <Icon name="chevron" size={18} color={colors.subtleText} mirror />
        </Row>
      </Card>
      <UpgradeRequestsSection product={product} />
      {shown.length ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{shown.map((x) => <LockedTile key={x.key} tile={x} compact onPress={() => tap(x.key)} />)}</View>
          {locked.length > shown.length ? (
            <Pressable onPress={() => router.push("/(tabs)/work" as never)} accessibilityRole="link" accessibilityLabel={t("lite.seeAllTools", { count: locked.length })} style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
              <T variant="small" weight="semibold" color={colors.ink2}>{t("lite.seeAllTools", { count: locked.length })} →</T>
            </Pressable>
          ) : null}
        </>
      ) : null}
      <UpgradeSheet product={product} featureKey={feature} onClose={() => setFeature(null)} />
    </View>
  );
}
