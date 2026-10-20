import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";
import { getRadarDashboardHtml } from "./radar-dashboard-html.js";
import { getSepIconPng, getSepManifestJson, getSepWorkspaceHtml } from "./sep-workspace-html.js";
import { sepWorkspaceRoutes } from "./sep-workspace-routes.js";

describe("VBAIBot Multi-Agent Workspace & System Radar Routes", () => {
  it("GET /bots trả về danh sách Agent, Kỹ năng (.agents/skills) và số liệu thực từ VBAIBot", async () => {
    const res = await sepWorkspaceRoutes.request("/bots");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      bots: { id: string; name: string; source: string }[];
      drafts: unknown[];
      activeSkills: { id: string; name: string }[];
      toolsCount: number;
    };
    assert.equal(body.ok, true);
    assert.ok(body.bots.length >= 2);
    assert.ok(body.bots.some((b) => b.id === "sep-chief"));
    assert.ok(body.bots.some((b) => b.id === "xuong-skill"));
    assert.ok(body.activeSkills.length > 0);
    assert.ok(body.toolsCount > 0);
  });

  it("HTML /sep và /radar hiển thị dữ liệu thực tế từ hệ thống VBAIBot, không chứa tên riêng ngoài hệ thống", () => {
    const sepHtml = getSepWorkspaceHtml();
    assert.ok(sepHtml.includes("VBAIBot"));
    assert.ok(sepHtml.includes("/api/public/sep/chat"));
    assert.ok(sepHtml.includes("renderBeanSvg"));
    assert.ok(sepHtml.includes("bean-stack"));
    assert.ok(sepHtml.includes("preview-fan"));
    assert.ok(sepHtml.includes("md-table"));
    assert.ok(sepHtml.includes("voice-wave-mini"));
    assert.ok(!sepHtml.includes("Jakie"));
    assert.ok(!sepHtml.includes("Nguyễn Tất Kiểm"));

    const sepScript = sepHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    assert.ok(sepScript.length > 100);
    assert.doesNotThrow(() => new vm.Script(sepScript));

    const png192 = getSepIconPng(192);
    assert.ok(png192.length > 500);
    assert.equal(png192[0], 137);
    assert.equal(png192[1], 80); // 'P'

    const manifest = JSON.parse(getSepManifestJson()) as { start_url: string; display: string };
    assert.equal(manifest.start_url, "/sep");
    assert.equal(manifest.display, "standalone");

    const radarHtml = getRadarDashboardHtml();
    const radarScript = radarHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    assert.ok(radarScript.length > 50);
    assert.doesNotThrow(() => new vm.Script(radarScript));
    assert.ok(radarHtml.includes("Bảng Hoạt động & Nhu cầu Thực tế VBAIBot"));
    assert.ok(radarHtml.includes("Bản đồ nhiệt Hoạt động 7 ngày & Công cụ"));
    assert.ok(radarHtml.includes("KIẾN TRÚC NĂNG LỰC HỆ THỐNG VBAIBOT"));
    assert.ok(radarHtml.includes("radar-sidebar"));
    assert.ok(radarHtml.includes("hm-o4"));
    assert.ok(radarHtml.includes("hm-t4"));
    assert.ok(radarHtml.includes("p-bar"));
    assert.ok(!radarHtml.includes("Jakie"));
    assert.ok(!radarHtml.includes("Nguyễn Tất Kiểm"));
  });
});
