import { rxActions } from "@/modules/pharmacy/lib";

const pharmacist = { canValidate: true, canSign: true }, manager = { canValidate: true, canSign: false }, cashier = { canValidate: false, canSign: false };

describe("Rx detail actions by status and role", () => {
  it("pharmacist: validate/reject/run checks while awaiting verification, and can still dispense once VALIDATED (no dead end after Mark as validated)", () => {
    expect(rxActions("RECEIVED", pharmacist)).toMatchObject({ validate: true, reject: true, dispense: true, footer: true, needsValidation: true });
    expect(rxActions("VALIDATING", pharmacist)).toMatchObject({ validate: true, dispense: true, footer: true });
    expect(rxActions("VALIDATED", pharmacist)).toMatchObject({ validate: false, reject: false, dispense: true, footer: true, needsValidation: false });
    expect(rxActions("PARTIALLY_DISPENSED", pharmacist)).toMatchObject({ dispense: true, footer: true });
  });
  it("manager validates / rejects but never signs off a dispensing", () => {
    expect(rxActions("RECEIVED", manager)).toMatchObject({ validate: true, reject: true, dispense: false, footer: true });
    expect(rxActions("VALIDATED", manager)).toMatchObject({ dispense: false, footer: false });
  });
  it("cashier / assistant: read-only Rx screen", () => {
    for (const s of ["RECEIVED", "VALIDATING", "VALIDATED", "PARTIALLY_DISPENSED"]) expect(rxActions(s, cashier)).toMatchObject({ validate: false, reject: false, dispense: false, footer: false });
  });
  it("finished prescriptions offer nothing", () => {
    for (const s of ["DISPENSED", "REJECTED", "CANCELLED", "EXPIRED", undefined]) expect(rxActions(s, pharmacist).footer).toBe(false);
  });
});
