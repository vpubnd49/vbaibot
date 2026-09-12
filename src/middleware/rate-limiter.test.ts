import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

// rate-limiter đọc SEND_DELAY_* từ env lúc import (test-env-setup đặt delay = 0)
let dataDir: string;
let limiter: typeof import("./rate-limiter.js");

before(async () => {
  dataDir = setupTestEnv();
  limiter = await import("./rate-limiter.js");
});

after(async () => {
  // Đọc cấu hình chỉnh-nóng nên module này mở SQLite - không đóng thì
  // Windows chặn xóa thư mục tạm (EPERM)
  (await import("../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("rate-limiter", () => {
  it("gửi tuần tự trong cùng thread, không chồng lấn", async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
      events.push(`start:${name}`);
      await sleep(20);
      events.push(`end:${name}`);
      return name;
    };

    const first = limiter.enqueueSend("t-1", task("A"));
    const second = limiter.enqueueSend("t-1", task("B"));
    assert.deepEqual(await Promise.all([first, second]), ["A", "B"]);
    assert.deepEqual(events, ["start:A", "end:A", "start:B", "end:B"]);
  });

  it("task lỗi vẫn ném về caller nhưng không làm chết queue của thread", async () => {
    await assert.rejects(() =>
      limiter.enqueueSend("t-loi", async () => {
        throw new Error("gửi thất bại");
      }),
    );
    assert.equal(await limiter.enqueueSend("t-loi", async () => "sau-loi"), "sau-loi");
  });

  it("thread gửi xong thì bỏ khỏi Map - không rò rỉ theo số thread từng gặp", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => limiter.enqueueSend(`t-ro-ri-${i}`, async () => i)),
    );
    // Bước dọn nằm ở microtask sau khi task resolve
    await sleep(10);
    assert.equal(limiter.pendingSendThreadCount(), 0);
  });

  /**
   * Hồi quy cho khe hở giữa hai ĐOẠN của một câu trả lời dài.
   *
   * `sendReplyInParts` await xong đoạn này mới xếp đoạn kế, nên `queues` rỗng
   * đúng lúc đang chuẩn bị gửi đoạn tiếp - `dangGuiTren` cũ hỏi `queues.has()`
   * nên trả false, và tin trấn an chen được vào giữa câu trả lời.
   */
  it("dangGuiTren vẫn TRUE giữa hai đoạn của cùng một chuỗi reply", async () => {
    limiter.batDauGuiChuoi("t-chuoi");
    assert.equal(limiter.dangGuiTren("t-chuoi"), true, "đang trong chuỗi phải coi là đang gửi");

    // Đoạn 1 gửi xong: hàng đợi đã rỗng nhưng chuỗi CHƯA kết thúc
    await limiter.enqueueSend("t-chuoi", async () => "doan-1");
    await sleep(10);
    assert.equal(limiter.pendingSendThreadCount(), 0, "điều kiện tiên quyết: queues đã rỗng");
    assert.equal(limiter.dangGuiTren("t-chuoi"), true, "khe hở giữa hai đoạn phải được bịt");

    limiter.ketThucGuiChuoi("t-chuoi");
    assert.equal(limiter.dangGuiTren("t-chuoi"), false, "hết chuỗi thì trả lại trạng thái rảnh");
  });

  it("đếm chuỗi lồng nhau không tắt sớm khi chuỗi ngoài còn chạy", () => {
    limiter.batDauGuiChuoi("t-long");
    limiter.batDauGuiChuoi("t-long");
    limiter.ketThucGuiChuoi("t-long");
    assert.equal(limiter.dangGuiTren("t-long"), true, "còn một chuỗi chưa xong thì vẫn đang gửi");
    limiter.ketThucGuiChuoi("t-long");
    assert.equal(limiter.dangGuiTren("t-long"), false);
  });
});
