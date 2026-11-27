import { stripSvgRootAria } from "@/lib/svgXml";

describe("stripSvgRootAria", () => {
  it("drops role and aria attributes of the root only", () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="10" role="img" aria-label="Card &amp; more"><g aria-label="keep"/></svg>';
    expect(stripSvgRootAria(xml)).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="10"><g aria-label="keep"/></svg>');
  });
  it("leaves anything that is not an svg document alone", () => {
    expect(stripSvgRootAria("not xml")).toBe("not xml");
  });
});
