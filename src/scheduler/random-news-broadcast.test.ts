import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NEWS_SLOTS,
  generateRandomTimeForSlot,
  isRandomNewsBroadcastEnabled,
  setRandomNewsBroadcastEnabled,
} from "./random-news-broadcast.js";

test("Random news broadcast: cấu hình và sinh thời gian ngẫu nhiên", () => {
  assert.equal(NEWS_SLOTS.length, 3);

  for (const slot of NEWS_SLOTS) {
    const time = generateRandomTimeForSlot(slot);
    assert.ok(time.hour >= slot.minHour && time.hour <= slot.maxHour);
    assert.ok(time.minute >= 0 && time.minute < 60);
    assert.ok(time.cronExpr.includes("* * *"));
  }

  const original = isRandomNewsBroadcastEnabled();
  setRandomNewsBroadcastEnabled(true);
  assert.equal(isRandomNewsBroadcastEnabled(), true);

  setRandomNewsBroadcastEnabled(false);
  assert.equal(isRandomNewsBroadcastEnabled(), false);

  setRandomNewsBroadcastEnabled(original);
});
