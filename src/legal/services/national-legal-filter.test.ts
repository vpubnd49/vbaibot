import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Test bóc tách hàm normalizeSoHieu và logic filter exact-match.
 *
 * Đây là các hàm nội bộ (không export) của national-legal-service.ts.
 * Tái hiện logic ở đây để kiểm chứng các fix mà KHÔNG cần gọi API thật.
 */

// ── Copy hàm normalizeSoHieu SAU fix ──
function normalizeSoHieu(sh: string): string {
  return sh.replace(/[\s/-]/g, "").toUpperCase().replace(/Đ/g, "D");
}

// ─── normalizeSoHieu ───────────────────────────────────────────────

describe("normalizeSoHieu", () => {
  it("QĐ-TTg → QDTTG (Đ phải thành D)", () => {
    assert.equal(normalizeSoHieu("QĐ-TTg"), "QDTTG");
  });

  it("CĐ-TTg → CDTTG", () => {
    assert.equal(normalizeSoHieu("CĐ-TTg"), "CDTTG");
  });

  it("NĐ-CP → NDCP", () => {
    assert.equal(normalizeSoHieu("NĐ-CP"), "NDCP");
  });

  it("1805/2026/QĐ-TTg → 18052026QDTTG", () => {
    assert.equal(normalizeSoHieu("1805/2026/QĐ-TTg"), "18052026QDTTG");
  });

  it("66/2026/CĐ-TTg → 662026CDTTG", () => {
    assert.equal(normalizeSoHieu("66/2026/CĐ-TTg"), "662026CDTTG");
  });

  it("347/2026/NĐ-CP → 3472026NDCP", () => {
    assert.equal(normalizeSoHieu("347/2026/NĐ-CP"), "3472026NDCP");
  });

  it("VBHN-LQ-VPQH giữ nguyên (không có Đ)", () => {
    assert.equal(normalizeSoHieu("139/2026/VBHN-LQ-VPQH"), "1392026VBHNLQVPQH");
  });
});

// ─── Filter soLoai: exact match cho số/loại ────────────────────────

describe("filter soLoai (số/loại, không năm)", () => {
  function simulateSoLoaiFilter(keyword: string, soHieus: string[]): string[] {
    const soLoai = keyword.match(/\b(\d+)\/([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/)
      || keyword.match(/\b(\d+)\s+([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/);
    if (!soLoai) return soHieus; // no filter
    const wantedNum = soLoai[1];
    const wantedType = normalizeSoHieu(soLoai[2]);
    const exact = soHieus.filter((sh) => {
      const leadingNum = sh.match(/^(\d+)/)?.[1];
      const norm = normalizeSoHieu(sh);
      return leadingNum === wantedNum && norm.includes(wantedType);
    });
    // BẮT BUỘC splice — kể cả exact=0
    return exact;
  }

  it("'1805/QĐ-TTg' giữ đúng 1805/2026/QĐ-TTg, loại 66/2026/CĐ-TTg", () => {
    const r = simulateSoLoaiFilter("1805/QĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
      "185/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("'66/CĐ-TTg' giữ đúng 66/2026/CĐ-TTg", () => {
    const r = simulateSoLoaiFilter("66/CĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["66/2026/CĐ-TTg"]);
  });

  it("'139/VBHN-LQ-VPQH' giữ đúng VB hợp nhất", () => {
    const r = simulateSoLoaiFilter("139/VBHN-LQ-VPQH", [
      "139/2026/VBHN-LQ-VPQH",
      "66/2026/CĐ-TTg",
    ]);
    assert.deepEqual(r, ["139/2026/VBHN-LQ-VPQH"]);
  });

  it("'1805 QĐ-TTg' (space thay slash) vẫn match nhờ fallback", () => {
    const r = simulateSoLoaiFilter("1805 QĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("startsWith ngăn 18053 match 1805", () => {
    const r = simulateSoLoaiFilter("1805/QĐ-TTg", [
      "18053/2026/QĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("không có VB nào match thì trả rỗng (KHÔNG fallback VB sai)", () => {
    const r = simulateSoLoaiFilter("9999/QĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, []);
  });
});

// ─── Filter shorthand: "quyết định 1805 thủ tướng" ────────────────

describe("filter shorthand - guard soLoai", () => {
  function simulateFullFilter(keyword: string, soHieus: string[]): string[] {
    let results = [...soHieus];
    const shorthand = keyword.match(/(?:qđ|quyết định)\s*(\d{1,6})(?:[^\d]|$)/i);

    // soLoai filter
    let soLoai: RegExpMatchArray | null = null;
    const explicit = keyword.match(/\b\d+\/\d{4}\/[A-ZĐa-zđ0-9_-]+\b/);
    if (explicit) {
      const wanted = normalizeSoHieu(explicit[0]);
      results = results.filter((r) => normalizeSoHieu(r) === wanted);
    } else {
      const short = keyword.match(/\b\d+\/\d{4}\b/);
      if (short) {
        const wanted = normalizeSoHieu(short[0]);
        results = results.filter((r) => normalizeSoHieu(r).startsWith(wanted));
      } else {
        soLoai = keyword.match(/\b(\d+)\/([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/)
          || keyword.match(/\b(\d+)\s+([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/);
        if (soLoai) {
          const wantedNum = soLoai[1];
          const wantedType = normalizeSoHieu(soLoai[2]);
          const exact = results.filter((r) => {
            const leadingNum = r.match(/^(\d+)/)?.[1];
            const norm = normalizeSoHieu(r);
            return leadingNum === wantedNum && norm.includes(wantedType);
          });
          if (exact.length > 0) results = exact;
          else results = []; // Bắt buộc: không trả VB sai
        }
      }
    }

    // shorthand filter - GUARDED by !soLoai
    if (shorthand?.[1] && !soLoai) {
      const wantedNumber = shorthand[1];
      const qdttgNorm = normalizeSoHieu("QĐ-TTg");
      results = results.filter((r) => {
        const normalized = normalizeSoHieu(r);
        return normalized.startsWith(normalizeSoHieu(wantedNumber)) && normalized.includes(qdttgNorm);
      });
    }

    return results;
  }

  it("'quyết định 1805 thủ tướng' (shorthand, no soLoai) → chỉ giữ QĐ-TTg số 1805", () => {
    const r = simulateFullFilter("quyết định 1805 thủ tướng", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
      "185/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("'Quyết định số 1805/QĐ-TTg' (cả soLoai LẪN shorthand) → soLoai thắng, shorthand bị skip", () => {
    const r = simulateFullFilter("Quyết định số 1805/QĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("'tải 1805/QĐ-TTg' (soLoai match, no shorthand) → exact match", () => {
    const r = simulateFullFilter("tải 1805/QĐ-TTg", [
      "66/2026/CĐ-TTg",
      "1805/2026/QĐ-TTg",
    ]);
    assert.deepEqual(r, ["1805/2026/QĐ-TTg"]);
  });

  it("'347/2026/NĐ-CP' (explicit full) → exact match", () => {
    const r = simulateFullFilter("347/2026/NĐ-CP", [
      "347/2026/NĐ-CP",
      "66/2026/CĐ-TTg",
    ]);
    assert.deepEqual(r, ["347/2026/NĐ-CP"]);
  });
});

// ─── Regex laYeuCauTraCuuVB (agent-loop) ───────────────────────────

describe("laYeuCauTraCuuVB regex", () => {
  const re = /tải|download|gửi file|tra cứu|tìm|vbhn|văn bản hợp nhất|\d+\/\d{4}\/[a-zA-ZĐđ]|\d+\/[A-ZĐđa-z]+-[A-Za-z]/i;

  it("'tải 1805/QĐ-TTg' → true", () => {
    assert.ok(re.test("tải 1805/QĐ-TTg"));
  });

  it("'1805/QĐ-TTg' → true (số/loại pattern)", () => {
    assert.ok(re.test("1805/QĐ-TTg"));
  });

  it("'347/2026/NĐ-CP' → true (số/năm/loại pattern)", () => {
    assert.ok(re.test("347/2026/NĐ-CP"));
  });

  it("'66/CĐ-TTg' → true", () => {
    assert.ok(re.test("66/CĐ-TTg"));
  });

  it("'tìm nghị định 30' → true (chứa 'tìm')", () => {
    assert.ok(re.test("tìm nghị định 30"));
  });

  it("'xin chào' → false", () => {
    assert.ok(!re.test("xin chào"));
  });
});
