import { describe, expect, test } from "vite-plus/test";
import {
  BEHAVIOR_MODES_IN_ORDER,
  BehaviorMode,
  BehaviorModes,
  behaviorCycleOf,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  formatBehaviorMode,
  isBehaviorMode,
} from "../src/types/index.ts";

describe("BehaviorMode typing and order", () => {
  test("BEHAVIOR_MODES_IN_ORDER lists 0…6 once, matching enum ids", () => {
    expect(BEHAVIOR_MODES_IN_ORDER).toHaveLength(7);
    expect([...new Set(BEHAVIOR_MODES_IN_ORDER)]).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(BEHAVIOR_MODES_IN_ORDER[i]).toBe(i);
      expect(isBehaviorMode(i)).toBe(true);
    }
    expect(isBehaviorMode(7)).toBe(false);
    expect(isBehaviorMode(3.5)).toBe(false);
    expect(isBehaviorMode("0")).toBe(false);
  });

  test("DEFAULT_NEKO_BEHAVIOR_CYCLE matches canonical order", () => {
    expect(DEFAULT_NEKO_BEHAVIOR_CYCLE).toEqual([...BEHAVIOR_MODES_IN_ORDER]);
  });

  test("formatBehaviorMode uses enum names and labels, not raw ids", () => {
    expect(formatBehaviorMode(undefined)).toBe("—");
    expect(formatBehaviorMode(BehaviorMode.ChaseMouse)).toBe("ChaseMouse — Chase pointer");
    expect(formatBehaviorMode(BehaviorMode.ReturnHomeAndStay)).toBe(
      "ReturnHomeAndStay — Return home & stay",
    );
  });

  test("behaviorCycleOf returns BehaviorCycle type (stable array)", () => {
    const c = behaviorCycleOf(BehaviorMode.ChaseMouse, BehaviorMode.StayStill);
    expect(c).toEqual([BehaviorMode.ChaseMouse, BehaviorMode.StayStill]);
  });

  test("BehaviorModes aliases align with BEHAVIOR_MODES_IN_ORDER", () => {
    const fromAliases = [
      BehaviorModes.chase,
      BehaviorModes.runAway,
      BehaviorModes.random,
      BehaviorModes.pace,
      BehaviorModes.ballChase,
      BehaviorModes.stayStill,
      BehaviorModes.returnHome,
    ];
    expect(fromAliases).toEqual([...BEHAVIOR_MODES_IN_ORDER]);
  });
});
