import { describe, it, expect } from "vitest";
import { detectIpAddresses } from "../../../src/modules/inspection/detectors/ipAddress.detector.js";

describe("detectIpAddresses", () => {
  it("detects a valid IPv4 address", () => {
    expect(detectIpAddresses("Server at 192.168.1.1")).toHaveLength(1);
  });

  it("rejects an out-of-range octet", () => {
    // 999 is not a valid octet — this proves the range pattern works,
    // not just \d{1,3}
    expect(detectIpAddresses("999.999.999.999")).toHaveLength(0);
  });
});