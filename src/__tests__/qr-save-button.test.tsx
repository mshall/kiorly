import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { QrSaveButton } from "@/components/QrSaveButton";

const mockSave = jest.fn(); const mockShare = jest.fn();
jest.mock("@/lib/qrImage", () => ({ saveQrImage: (...a: unknown[]) => mockSave(...a) }));
jest.mock("@/lib/shareLink", () => ({ shareLink: (...a: unknown[]) => mockShare(...a) }));
const wrap = () => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider><QrSaveButton svg="<svg/>" url="https://k.test/q/ABCD" name="Front desk" /></ToastProvider></ThemeProvider></SafeAreaProvider>);
beforeEach(async () => { mockSave.mockReset(); mockShare.mockReset(); await act(async () => { await i18n.changeLanguage("en"); }); });
afterEach(async () => { await act(async () => { await i18n.changeLanguage("ar"); }); });

describe("QrSaveButton (G-16)", () => {
  it("saves the image with the link name and confirms", async () => {
    mockSave.mockResolvedValue("shared"); await wrap();
    await fireEvent.press(screen.getByTestId("qr-save"));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith("<svg/>", "Front desk"));
    expect(await screen.findByText("QR image ready: choose Save Image")).toBeTruthy(); expect(mockShare).not.toHaveBeenCalled();
  });
  it("Android (unsupported) tells the user and shares the link instead", async () => {
    mockSave.mockResolvedValue("unsupported"); await wrap();
    await fireEvent.press(screen.getByTestId("qr-save"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith("https://k.test/q/ABCD", "https://k.test/q/ABCD"));
    expect(await screen.findByText("Saving an image is not available here", { exact: false })).toBeTruthy();
  });
  it("a failure shows the error and shares nothing; a dismissed sheet is silent", async () => {
    mockSave.mockResolvedValue("failed"); await wrap();
    await fireEvent.press(screen.getByTestId("qr-save")); expect(await screen.findByText("Could not make the QR image", { exact: false })).toBeTruthy();
    mockSave.mockResolvedValue("dismissed"); await fireEvent.press(screen.getByTestId("qr-save")); expect(mockShare).not.toHaveBeenCalled();
  });
  it("the label is Arabic in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); }); await wrap();
    expect(screen.getByText("حفظ صورة QR")).toBeTruthy();
  });
});
