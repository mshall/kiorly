import { activeLinks, conversion, featuredLink, linkName, nextLinkQuota, pct, providerShare, shareMessage, smsUrl, whatsappUrl, type GrowthLink, type GrowthPerformance } from "@/modules/clinic/growth";

const L = (o: Partial<GrowthLink>): GrowthLink => ({ id: "l", code: "ABCD2345", label: "Desk", ownerScope: "DESK", channelKind: "QR_DESK", status: "ACTIVE", shortUrl: "https://kiorly.link/q/ABCD2345", targetNameEn: "Dr Nadia", targetNameAr: "د. نادية", last30: { visits: 0, bookings: 0, attended: 0 }, ...o });
const perf = (a: number, b: number): GrowthPerformance => ({
  days: 30, providerOriginated: { bookings: a, attended: 0, cancelledOrNoShow: 0, newPatients: 0, attendedRate: null, cancellationRate: null }, marketplaceOriginated: { bookings: b, attended: 0, cancelledOrNoShow: 0, newPatients: 0, attendedRate: null, cancellationRate: null },
  links: { visits: 0, bookings: 0, attended: 0, visitToBooking: null, bookingToAttended: null }, incrementalMarketplaceRevenue: 0, commission: { currency: "EGP", total: 0, incrementalRevenueNet: 0 },
});

describe("growth helpers", () => {
  it("builds WhatsApp and SMS share links with the URL last and encoded", () => {
    const m = shareMessage("Dr Nadia", "https://kiorly.link/q/ABCD2345", "en");
    expect(m).toBe("Book with Dr Nadia on Kiorex: https://kiorly.link/q/ABCD2345");
    expect(whatsappUrl(m)).toBe(`https://wa.me/?text=${encodeURIComponent(m)}`);
    expect(smsUrl(m)).toBe(`sms:?&body=${encodeURIComponent(m)}`);
    expect(shareMessage("د. نادية", "https://x/q/A", "ar")).toMatch(/^احجز موعدك مع د\. نادية عبر كيوريكس: https:\/\/x\/q\/A$/);
  });
  it("computes conversion and provider share without NaN", () => {
    expect(conversion(0, 5)).toBeNull();
    expect(conversion(40, 10)).toBe(25);
    expect(pct(null)).toBeNull();
    expect(pct(0.256)).toBe(26);
    expect(providerShare(null)).toBeNull();
    expect(providerShare(perf(0, 0))).toBeNull();
    expect(providerShare(perf(3, 1))).toBe(75);
  });
  it("features the most-booked ACTIVE link and ignores paused ones", () => {
    const links = [L({ id: "a", last30: { visits: 9, bookings: 1, attended: 0 } }), L({ id: "b", last30: { visits: 9, bookings: 5, attended: 0 } }), L({ id: "c", status: "PAUSED", last30: { visits: 99, bookings: 99, attended: 0 } })];
    expect(featuredLink(links)?.id).toBe("b");
    expect(activeLinks(links).length).toBe(2);
    expect(featuredLink([L({ status: "PAUSED" })])).toBeNull();
  });
  it("names a link by language and computes the remaining plan quota", () => {
    expect(linkName(L({}), "ar")).toBe("د. نادية");
    expect(linkName(L({}), "en")).toBe("Dr Nadia");
    expect(linkName(L({ targetNameEn: "", targetNameAr: "" }), "en")).toBe("Desk");
    expect(nextLinkQuota(null)).toBeNull();
    expect(nextLinkQuota({ key: "PRO", maxActiveLinks: 25, linksUsed: 30 })).toBe(0);
    expect(nextLinkQuota({ key: "PRO", maxActiveLinks: 25, linksUsed: 5 })).toBe(20);
  });
});
