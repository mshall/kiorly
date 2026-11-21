import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, ScrollView, View, type LayoutChangeEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";

/** The slices of the (typed-as-component) ScrollView / TextInput instances that scroll-into-view uses. */
export interface ScrollHandle { scrollTo: (o: { y: number; animated?: boolean }) => void; getInnerViewRef: () => unknown }
export interface InputHandle { measureLayout: (relativeTo: never, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail: () => void) => void }

/**
 * Keyboard handling shared by every screen that has a TextInput.
 *
 * Android 15 is edge-to-edge (the window no longer resizes for the keyboard) and iOS never resized it, so the
 * keyboard covers fields unless the layout reacts itself. Pieces:
 *  - `KeyboardAvoider`: `KeyboardAvoidingView` with `behavior="padding"` on BOTH platforms. It measures its own
 *    window offset (native header, status bar) so the padding is exact, and reports whether the keyboard is open.
 *  - `useScrollIntoView` / `ScrollIntoViewContext`: `Field` calls `scrollIntoView(input)` on focus, which scrolls the
 *    enclosing ScrollView so the focused field sits in the visible area above the keyboard.
 *  - `KeyboardForm`: Avoider + ScrollView (`keyboardShouldPersistTaps="handled"`) + scroll-into-view in one wrapper,
 *    for screens that do not use `Screen`. `Screen` and `Sheet` in ui.tsx are built from the same parts.
 */

interface ScrollIntoView { scrollIntoView: (input: InputHandle | null) => void }
export const ScrollIntoViewContext = createContext<ScrollIntoView>({ scrollIntoView: () => {} });
export const useScrollIntoViewContext = () => useContext(ScrollIntoViewContext);

/** True while the software keyboard is shown. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const subs = [
      Keyboard.addListener("keyboardDidShow", () => setVisible(true)),
      Keyboard.addListener("keyboardDidHide", () => setVisible(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return visible;
}

/** `KeyboardAvoidingView` (padding on both platforms) whose vertical offset is its own distance from the window top. */
export function KeyboardAvoider({ children, style, enabled = true, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; enabled?: boolean; testID?: string }) {
  const ref = useRef<{ measureInWindow: (cb: (x: number, y: number) => void) => void } | null>(null);
  const [offset, setOffset] = useState(0);
  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => { if (Number.isFinite(y)) setOffset((o) => (Math.abs(o - y) < 0.5 ? o : y)); });
  }, []);
  const onLayout = useCallback((_e: LayoutChangeEvent) => measure(), [measure]);
  return (
    <View ref={ref as never} collapsable={false} onLayout={onLayout} style={[{ flex: 1 }, style]}>
      <KeyboardAvoidingView testID={testID} behavior="padding" enabled={enabled} keyboardVerticalOffset={offset} style={[{ flex: 1 }, style]}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Returns a ScrollView ref plus the context value that lets `Field` scroll itself into view when focused. */
export function useScrollIntoView() {
  const scrollRef = useRef<ScrollHandle | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollIntoView = useCallback((input: InputHandle | null) => {
    const scroll = scrollRef.current;
    if (!scroll || !input) return;
    const run = () => {
      const inner = scroll.getInnerViewRef();
      if (!inner) return;
      input.measureLayout(inner as never, (_x: number, y: number) => { scroll.scrollTo({ y: Math.max(0, y - 96), animated: true }); }, () => {});
    };
    // The keyboard (and the padding it triggers) lands after focus; scroll again once the viewport has shrunk.
    if (pending.current) clearTimeout(pending.current);
    const sub = Keyboard.addListener("keyboardDidShow", () => { sub.remove(); run(); });
    pending.current = setTimeout(() => { sub.remove(); run(); }, 350);
  }, []);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);
  return { scrollRef, value: { scrollIntoView } as ScrollIntoView };
}

/** Avoider + ScrollView + scroll-into-view, for screens that are not built on `Screen`. */
export function KeyboardForm({ children, contentContainerStyle, style, footer, testID, ...rest }: ScrollViewProps & { children: ReactNode; footer?: ReactNode }) {
  const { scrollRef, value } = useScrollIntoView();
  return (
    <KeyboardAvoider style={style as StyleProp<ViewStyle>}>
      <ScrollIntoViewContext.Provider value={value}>
        <ScrollView ref={scrollRef as never} testID={testID} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={contentContainerStyle} {...rest}>{children}</ScrollView>
      </ScrollIntoViewContext.Provider>
      {footer}
    </KeyboardAvoider>
  );
}
