import { View } from "react-native";
import Svg, { Circle, Path, Polyline, Line, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { isRtlLang } from "@/i18n";

// 24x24 stroke icons (Lucide-style geometry, drawn inline so no icon font is needed on web/native).
const P: Record<string, (c: string) => React.ReactNode> = {
  home: (c) => <><Path d="M3 11l9-8 9 8" stroke={c} /><Path d="M5 10v10h14V10" stroke={c} /></>,
  calendar: (c) => <><Rect x="3" y="5" width="18" height="16" rx="2" stroke={c} /><Line x1="3" y1="10" x2="21" y2="10" stroke={c} /><Line x1="8" y1="3" x2="8" y2="7" stroke={c} /><Line x1="16" y1="3" x2="16" y2="7" stroke={c} /></>,
  user: (c) => <><Circle cx="12" cy="8" r="4" stroke={c} /><Path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke={c} /></>,
  search: (c) => <><Circle cx="11" cy="11" r="7" stroke={c} /><Line x1="21" y1="21" x2="16.5" y2="16.5" stroke={c} /></>,
  chevron: (c) => <Polyline points="9 6 15 12 9 18" stroke={c} />,
  back: (c) => <Polyline points="15 6 9 12 15 18" stroke={c} />,
  check: (c) => <Polyline points="5 12 10 17 19 7" stroke={c} />,
  close: (c) => <><Line x1="6" y1="6" x2="18" y2="18" stroke={c} /><Line x1="18" y1="6" x2="6" y2="18" stroke={c} /></>,
  shield: (c) => <><Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" stroke={c} /><Polyline points="9 12 11 14 15 10" stroke={c} /></>,
  pin: (c) => <><Path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" stroke={c} /><Circle cx="12" cy="10" r="2.5" stroke={c} /></>,
  phone: (c) => <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke={c} />,
  clock: (c) => <><Circle cx="12" cy="12" r="9" stroke={c} /><Polyline points="12 7 12 12 15 14" stroke={c} /></>,
  star: (c) => <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" stroke={c} />,
  filter: (c) => <><Line x1="4" y1="6" x2="20" y2="6" stroke={c} /><Line x1="7" y1="12" x2="17" y2="12" stroke={c} /><Line x1="10" y1="18" x2="14" y2="18" stroke={c} /></>,
  alert: (c) => <><Path d="M12 3l10 18H2z" stroke={c} /><Line x1="12" y1="10" x2="12" y2="15" stroke={c} /><Line x1="12" y1="18" x2="12.01" y2="18" stroke={c} /></>,
  card: (c) => <><Rect x="2" y="5" width="20" height="14" rx="2" stroke={c} /><Line x1="2" y1="10" x2="22" y2="10" stroke={c} /></>,
  logout: (c) => <><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={c} /><Polyline points="16 17 21 12 16 7" stroke={c} /><Line x1="21" y1="12" x2="9" y2="12" stroke={c} /></>,
  users: (c) => <><Circle cx="9" cy="8" r="3.5" stroke={c} /><Path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" stroke={c} /><Path d="M16 4.5a3.5 3.5 0 010 7M18 15c2.5.6 4 2.2 4 5" stroke={c} /></>,
  device: (c) => <><Rect x="7" y="2" width="10" height="20" rx="2" stroke={c} /><Line x1="11" y1="18" x2="13" y2="18" stroke={c} /></>,
  trash: (c) => <><Polyline points="3 6 5 6 21 6" stroke={c} /><Path d="M19 6l-1 14H6L5 6M9 6V3h6v3" stroke={c} /></>,
  calendarPlus: (c) => <><Rect x="3" y="5" width="18" height="16" rx="2" stroke={c} /><Line x1="12" y1="12" x2="12" y2="18" stroke={c} /><Line x1="9" y1="15" x2="15" y2="15" stroke={c} /><Line x1="8" y1="3" x2="8" y2="7" stroke={c} /><Line x1="16" y1="3" x2="16" y2="7" stroke={c} /></>,
  file: (c) => <><Path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" stroke={c} /><Polyline points="14 3 14 8 19 8" stroke={c} /><Line x1="9" y1="13" x2="15" y2="13" stroke={c} /><Line x1="9" y1="17" x2="13" y2="17" stroke={c} /></>,
  pill: (c) => <><Rect x="3" y="9" width="18" height="6" rx="3" stroke={c} transform="rotate(-35 12 12)" /><Line x1="10" y1="7.5" x2="14.5" y2="16" stroke={c} /></>,
  flask: (c) => <><Path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3" stroke={c} /><Line x1="7.5" y1="15" x2="16.5" y2="15" stroke={c} /></>,
  video: (c) => <><Rect x="2" y="6" width="14" height="12" rx="2" stroke={c} /><Polyline points="16 10 22 7 22 17 16 14" stroke={c} /></>,
  bell: (c) => <><Path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" stroke={c} /><Path d="M10 21a2 2 0 004 0" stroke={c} /></>,
  upload: (c) => <><Line x1="12" y1="16" x2="12" y2="4" stroke={c} /><Polyline points="7 9 12 4 17 9" stroke={c} /><Path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke={c} /></>,
  image: (c) => <><Rect x="3" y="4" width="18" height="16" rx="2" stroke={c} /><Circle cx="9" cy="10" r="1.5" stroke={c} /><Polyline points="21 16 15 11 6 20" stroke={c} /></>,
  plus: (c) => <><Line x1="12" y1="5" x2="12" y2="19" stroke={c} /><Line x1="5" y1="12" x2="19" y2="12" stroke={c} /></>,
  list: (c) => <><Line x1="8" y1="6" x2="21" y2="6" stroke={c} /><Line x1="8" y1="12" x2="21" y2="12" stroke={c} /><Line x1="8" y1="18" x2="21" y2="18" stroke={c} /><Circle cx="4" cy="6" r="1" stroke={c} /><Circle cx="4" cy="12" r="1" stroke={c} /><Circle cx="4" cy="18" r="1" stroke={c} /></>,
  cart: (c) => <><Circle cx="9" cy="20" r="1.5" stroke={c} /><Circle cx="18" cy="20" r="1.5" stroke={c} /><Path d="M2 3h3l2.7 12.4a1 1 0 001 .8h8.8a1 1 0 001-.8L20 7H6" stroke={c} /></>,
  lock: (c) => <><Rect x="5" y="11" width="14" height="10" rx="2" stroke={c} /><Path d="M8 11V8a4 4 0 018 0v3" stroke={c} /></>,
  mic: (c) => <><Rect x="9" y="3" width="6" height="11" rx="3" stroke={c} /><Path d="M5 11a7 7 0 0014 0M12 18v3" stroke={c} /></>,
  phoneOff: (c) => <><Path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke={c} /><Line x1="3" y1="21" x2="21" y2="3" stroke={c} /></>,
  globe: (c) => <><Circle cx="12" cy="12" r="9" stroke={c} /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={c} /></>,
  stethoscope: (c) => <><Path d="M6 3v6a4 4 0 008 0V3" stroke={c} /><Path d="M10 13v2a5 5 0 0010 0v-2" stroke={c} /><Circle cx="20" cy="11" r="2" stroke={c} /></>,
  scan: (c) => <><Path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" stroke={c} /><Line x1="7" y1="12" x2="17" y2="12" stroke={c} /></>,
  sync: (c) => <><Path d="M20 11a8 8 0 00-14.5-4M4 13a8 8 0 0014.5 4" stroke={c} /><Polyline points="20 4 20 11 13 11" stroke={c} /><Polyline points="4 20 4 13 11 13" stroke={c} /></>,
  wifiOff: (c) => <><Path d="M2 8.8a15 15 0 0110-3.8M5 12.5a10 10 0 015-2.5M9 16a5 5 0 016 0" stroke={c} /><Line x1="12" y1="20" x2="12.01" y2="20" stroke={c} /><Line x1="3" y1="3" x2="21" y2="21" stroke={c} /></>,
  activity: (c) => <Polyline points="3 12 7 12 10 4 14 20 17 12 21 12" stroke={c} />,
  chart: (c) => <><Line x1="4" y1="20" x2="20" y2="20" stroke={c} /><Rect x="6" y="11" width="3" height="9" stroke={c} /><Rect x="11" y="6" width="3" height="14" stroke={c} /><Rect x="16" y="14" width="3" height="6" stroke={c} /></>,
  box: (c) => <><Path d="M3 7l9-4 9 4v10l-9 4-9-4z" stroke={c} /><Polyline points="3 7 12 11 21 7" stroke={c} /><Line x1="12" y1="11" x2="12" y2="21" stroke={c} /></>,
  receipt: (c) => <><Path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" stroke={c} /><Line x1="9" y1="8" x2="15" y2="8" stroke={c} /><Line x1="9" y1="12" x2="15" y2="12" stroke={c} /></>,
  clipboard: (c) => <><Rect x="6" y="4" width="12" height="17" rx="2" stroke={c} /><Rect x="9" y="2" width="6" height="4" rx="1" stroke={c} /><Line x1="9" y1="11" x2="15" y2="11" stroke={c} /><Line x1="9" y1="15" x2="13" y2="15" stroke={c} /></>,
  settings: (c) => <><Circle cx="12" cy="12" r="3" stroke={c} /><Path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" stroke={c} /></>,
  thermometer: (c) => <><Path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z" stroke={c} /></>,
  heart: (c) => <Path d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" stroke={c} />,
  moon: (c) => <Path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke={c} />,
  fingerprint: (c) => <><Path d="M12 11v4a6 6 0 01-1 3M8 14a4 4 0 018 0c0 2-.3 3.5-1 5M5 12a7 7 0 0114 0c0 3-.4 5.5-1.5 8M4 17c.7-1.5 1-3 1-5" stroke={c} /></>,
  eye: (c) => <><Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke={c} /><Circle cx="12" cy="12" r="3" stroke={c} /></>,
  navigation: (c) => <Polyline points="3 11 22 2 13 21 11 13 3 11" stroke={c} />,
  truck: (c) => <><Rect x="1" y="6" width="14" height="10" rx="1" stroke={c} /><Path d="M15 9h4l3 3v4h-7z" stroke={c} /><Circle cx="6" cy="18" r="2" stroke={c} /><Circle cx="18" cy="18" r="2" stroke={c} /></>,
  syringe: (c) => <><Path d="M18 2l4 4M20 4l-9 9M15 7l5 5M9 15l-5 5M7 13l4 4-4 1-1-1z" stroke={c} /></>,
  award: (c) => <><Circle cx="12" cy="9" r="6" stroke={c} /><Path d="M8.5 14L7 22l5-3 5 3-1.5-8" stroke={c} /></>,
  info: (c) => <><Circle cx="12" cy="12" r="9" stroke={c} /><Line x1="12" y1="11" x2="12" y2="16" stroke={c} /><Line x1="12" y1="8" x2="12.01" y2="8" stroke={c} /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, color, mirror = false, fill }: { name: IconName; size?: number; color: string; mirror?: boolean; fill?: string }) {
  const { i18n } = useTranslation();
  const flip = mirror && isRtlLang(i18n.language);
  return (
    <View aria-hidden style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? "none"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {P[name](color)}
      </Svg>
    </View>
  );
}
