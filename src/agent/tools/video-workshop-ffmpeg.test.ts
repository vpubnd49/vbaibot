import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionLabel, dungDoiSo } from "./video-workshop-ffmpeg.js";

const out = (ext: string) => `/tmp/out.${ext}`;

describe("dungDoiSo", () => {
  it("trim thiếu startTime → trả chuỗi lỗi, không dựng lệnh", () => {
    assert.equal(dungDoiSo("trim", "/in.mp4", out, {}), "Thiếu startTime.");
  });

  it("add_text thiếu text → trả chuỗi lỗi", () => {
    assert.equal(dungDoiSo("add_text", "/in.mp4", out, {}), "Thiếu text.");
  });

  it("trim có duration → thêm -t, copy stream", () => {
    const r = dungDoiSo("trim", "/in.mp4", out, { startTime: "00:00:05", duration: "10" });
    assert.ok(typeof r !== "string");
    assert.deepEqual(r.args, ["-i", "/in.mp4", "-ss", "00:00:05", "-t", "10", "-c", "copy", "-y", "/tmp/out.mp4"]);
    assert.equal(r.outputFile, "/tmp/out.mp4");
  });

  it("compress map quality → crf", () => {
    const crf = (q?: string) => {
      const r = dungDoiSo("compress", "/in.mp4", out, { quality: q });
      assert.ok(typeof r !== "string");
      return r.args[r.args.indexOf("-crf") + 1];
    };
    assert.equal(crf("high"), "23");
    assert.equal(crf("low"), "35");
    assert.equal(crf(undefined), "28");
  });

  it("extract_audio ra mp3", () => {
    const r = dungDoiSo("extract_audio", "/in.mp4", out, {});
    assert.ok(typeof r !== "string");
    assert.equal(r.outputFile, "/tmp/out.mp3");
  });

  it("add_text thoát \\ : ' % để chữ người dùng không phá cú pháp filter", () => {
    const r = dungDoiSo("add_text", "/in.mp4", out, { text: "a:b'c%d\\e" });
    assert.ok(typeof r !== "string");
    const vf = r.args[r.args.indexOf("-vf") + 1]!;
    assert.ok(vf.startsWith("drawtext=text='a\\:b\\'c\\%d\\\\e':"), vf);
  });

  it("tác vụ lạ → chuỗi lỗi", () => {
    assert.equal(dungDoiSo("hack", "/in.mp4", out, {}), "Tác vụ không hợp lệ.");
  });

  it("actionLabel có nhãn cho tác vụ chính", () => {
    assert.match(actionLabel("trim"), /Cắt video/);
  });
});
