// Regression: a pressable Card with `flex: 1` collapsed to content width because layout props were applied to the inner Pressable only.
import { splitLayoutStyle } from "@/components/ui";

describe("splitLayoutStyle", () => {
  it("moves flex/width/margin/alignSelf to the outer wrapper and keeps visuals inner", () => {
    const { outer, inner } = splitLayoutStyle({ flex: 1, minWidth: 96, padding: 14, gap: 6, alignSelf: "stretch", marginTop: 4, backgroundColor: "red" });
    expect(outer).toEqual({ flex: 1, minWidth: 96, alignSelf: "stretch", marginTop: 4 });
    expect(inner).toEqual({ padding: 14, gap: 6, backgroundColor: "red" });
  });
  it("returns no outer style when the card has no layout props", () => {
    const { outer, inner } = splitLayoutStyle([{ padding: 8 }, undefined, { borderWidth: 1 }]);
    expect(outer).toBeUndefined();
    expect(inner).toEqual({ padding: 8, borderWidth: 1 });
  });
});
