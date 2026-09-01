import { describe, it, expect } from "vitest";
import { detectCreditCards } from "../../../src/modules/inspection/detectors/creditCard.detector.js";

describe("detectCreditCards", () => {
  it("detects a real, Luhn-valid test card number", () => {
    // 4532015112830366 is a well-known Luhn-valid test number
    expect(detectCreditCards("Card: 4532015112830366")).toHaveLength(1);
  });

  it("rejects a 16-digit number that fails the Luhn check", () => {
    // This is the test that actually PROVES the Luhn step is doing
    // its job — a naive regex-only detector would wrongly flag this.
    expect(detectCreditCards("Order ID: 1234567812345678")).toHaveLength(0);
  });

  it("still detects a card number with spaces", () => {
    expect(detectCreditCards("4532 0151 1283 0366")).toHaveLength(1);
  });
});