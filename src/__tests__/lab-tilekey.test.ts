import i18n from "@/i18n";
it("k", () => { i18n.changeLanguage("en"); expect(i18n.t("tiles.lab.accession.title")).toBe("Accessioning"); });
