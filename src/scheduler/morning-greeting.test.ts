import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMorningGreetingEnabled,
  setMorningGreetingEnabled,
} from "./morning-greeting.js";

test("Morning greeting: bật tắt cấu hình", () => {
  const original = isMorningGreetingEnabled();

  setMorningGreetingEnabled(true);
  assert.equal(isMorningGreetingEnabled(), true);

  setMorningGreetingEnabled(false);
  assert.equal(isMorningGreetingEnabled(), false);

  // Restore
  setMorningGreetingEnabled(original);
});
