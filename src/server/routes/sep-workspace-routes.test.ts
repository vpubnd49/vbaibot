import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRadarDashboardHtml } from "./radar-dashboard-html.js";
import { getSepManifestJson, getSepWorkspaceHtml } from "./sep-workspace-html.js";
import { sepWorkspaceRoutes } from "./sep-workspace-routes.js";

describe("Sếp – Chief of Staff & Radar Dashboard Routes", () => {
  it("GET /bots trả về danh sách 8 bot chuyên môn và danh sách skill", async () => {
    const res = await sepWorkspaceRoutes.request("/bots");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      bots: { id: string; name: string }[];
      drafts: unknown[];
      activeSkills: unknown[];
    };
    assert.equal(body.ok, true);
    assert.equal(body.bots.length, 8);
    assert.ok(body.bots.some((b) => b.id === "sep-chief"));
    assert.ok(body.bots.some((b) => b.id === "xuong-skill"));
    assert.ok(body.bots.some((b) => b.id === "radar-cong-dong"));
    assert.ok(Array.isArray(body.drafts));
    assert.ok(Array.isArray(body.activeSkills));
  });

  it("HTML /sep và /radar có đủ cấu trúc PWA và 3 tab Radar", () => {
    const sepHtml = getSepWorkspaceHtml();
    assert.ok(sepHtml.includes("Sếp – Chief of Staff"));
    assert.ok(sepHtml.includes("/api/public/sep/chat"));
    assert.ok(sepHtml.includes("extractDecisionOptions"));

    const manifest = JSON.parse(getSepManifestJson()) as { start_url: string; display: string };
    assert.equal(manifest.start_url, "/sep");
    assert.equal(manifest.display, "standalone");

    const radarHtml = getRadarDashboardHtml();
    assert.ok(radarHtml.includes("Bảng cơ hội"));
    assert.ok(radarHtml.includes("Bản đồ nhiệt chủ đề"));
    assert.ok(radarHtml.includes("Phòng chiến lược đối thủ"));
  });
});
