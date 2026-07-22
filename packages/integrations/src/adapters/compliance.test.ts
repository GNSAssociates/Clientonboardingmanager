import { describe, it, expect } from "vitest";
import { companiesHouseAdapter } from "./companies-house.stub";
import { amiqusStubAdapter } from "./amiqus.stub";

describe("companiesHouseAdapter (stub)", () => {
  it("returns a plausible profile when CH_API_KEY is not set", async () => {
    delete process.env["CH_API_KEY"];
    const profile = await companiesHouseAdapter.getProfile("12345678");
    expect(profile.companyNumber).toBe("12345678");
    expect(profile.name).toContain("stub");
    expect(typeof profile.status).toBe("string");
  });

  it("search returns at least one result", async () => {
    delete process.env["CH_API_KEY"];
    const results = await companiesHouseAdapter.search("Acme");
    expect(results.length).toBeGreaterThan(0);
  });

  it("profile has required fields", async () => {
    delete process.env["CH_API_KEY"];
    const profile = await companiesHouseAdapter.getProfile("12345678");
    expect(profile).toHaveProperty("companyNumber");
    expect(profile).toHaveProperty("name");
    expect(profile).toHaveProperty("status");
  });
});

describe("amiqusStubAdapter (stub)", () => {
  it('reports provider as "amiqus"', () => {
    expect(amiqusStubAdapter.provider).toBe("amiqus");
  });

  it("initiate returns a ref when no API key set", async () => {
    delete process.env["AMIQUS_API_KEY"];
    const result = await amiqusStubAdapter.initiate({
      name: "John Smith",
      email: "john@example.com",
      checks: [],
    });
    expect(result.ref.startsWith("amiqus-stub-")).toBe(true);
  });

  it("getResult returns passed status in stub mode", async () => {
    delete process.env["AMIQUS_API_KEY"];
    const result = await amiqusStubAdapter.getResult("any-ref");
    expect(result.status).toBe("passed");
    expect(result.result).toBeDefined();
  });
});
