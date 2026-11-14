import { describe, expect, it } from "vitest";
import { fitRect } from "./renderExportCard";

const slot = { x: 45, y: 120, w: 500, h: 660 };

describe("fitRect", () => {
  it("covers a slot with a landscape photo, centred, cropping the sides", () => {
    const d = fitRect(1600, 1200, slot, "cover", "50% 50%");
    expect(d.h).toBeCloseTo(660);
    expect(d.w).toBeCloseTo(880);
    expect(d.y).toBeCloseTo(120);
    expect(d.x).toBeCloseTo(45 - 190);
  });

  it("covers a slot with a tall photo, cropping top and bottom", () => {
    const d = fitRect(900, 1600, slot, "cover", "50% 50%");
    expect(d.w).toBeCloseTo(500);
    expect(d.h).toBeCloseTo((1600 * 500) / 900);
    expect(d.x).toBeCloseTo(45);
    expect(d.y + d.h / 2).toBeCloseTo(120 + 330);
  });

  it("honours object-position", () => {
    expect(fitRect(1600, 1200, slot, "cover", "0% 0%").x).toBeCloseTo(45);
    expect(fitRect(1600, 1200, slot, "cover", "100% 0%").x).toBeCloseTo(45 - 380);
    expect(fitRect(900, 1600, slot, "cover", "50% 0%").y).toBeCloseTo(120);
    expect(fitRect(1600, 1200, slot, "cover", "10px 0px").x).toBeCloseTo(55);
  });

  it("supports contain and fill", () => {
    const c = fitRect(1600, 1200, slot, "contain", "50% 50%");
    expect(c.w).toBeCloseTo(500);
    expect(c.h).toBeCloseTo(375);
    expect(c.y).toBeCloseTo(120 + (660 - 375) / 2);
    expect(fitRect(1600, 1200, slot, "fill")).toEqual(slot);
  });

  it("falls back to the slot when the image has no size", () => {
    expect(fitRect(0, 0, slot, "cover")).toEqual(slot);
  });
});
