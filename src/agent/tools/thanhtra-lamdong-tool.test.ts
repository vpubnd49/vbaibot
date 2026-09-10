import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { ThreadType, type API } from "zca-js";
import { createThanhtraLamdongTool } from "./thanhtra-lamdong-tool.js";
import { upsertThanhtraDoc } from "../../thanhtra/thanhtra-store.js";
import type { ToolContext } from "./tool-catalog-types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const chay = (tool: unknown, input: unknown): Promise<unknown> =>
  (tool as any).execute(input, {});

describe("thanhtra_lamdong Tool", () => {
  before(() => {
    // Thêm dữ liệu mẫu vào SQLite để test tra cứu
    upsertThanhtraDoc({
      title: "Thông báo kết luận thanh tra công tác quản lý tại huyện Đắk Song",
      description: "Thanh tra dự án đường giao thông",
      fileRef: "/sites/thanhtra/SitePages/test-dak-song.aspx",
      pdfUrl: "https://lamdong.gov.vn/sites/thanhtra/Shared%20Documents/KL_test_daksong.pdf",
      localPath: "thanhtra/KL_test_daksong.pdf",
      fileSize: 102400,
      modifiedAt: "2026-09-08T10:00:00Z",
    });

    upsertThanhtraDoc({
      title: "Kết luận thanh tra Công ty TNHH Công nghệ môi trường xanh Đà Lạt",
      description: "Thanh tra chấp hành pháp luật môi trường",
      fileRef: "/sites/thanhtra/SitePages/test-mtx.aspx",
      pdfUrl: "https://lamdong.gov.vn/sites/thanhtra/Shared%20Documents/KL_test_mtx.pdf",
      localPath: "thanhtra/KL_test_mtx.pdf",
      fileSize: 204800,
      modifiedAt: "2026-09-04T10:00:00Z",
    });
  });

  const daGui: string[] = [];
  const fakeApi = {
    sendFile: async (_threadId: string, _type: any, _path: string) => {
      daGui.push(_path);
      return {};
    },
  } as unknown as API;

  const testMsg = {
    accountId: "acc-test",
    threadId: "t-1",
    threadType: ThreadType.User,
    isGroup: false,
    senderId: "u-1",
    senderName: "Châu",
    text: "tìm kết luận thanh tra",
    images: [],
    msgId: "m-1",
    cliMsgId: "c-1",
    isSelf: false,
    mentionsMe: false,
    rawData: {},
  };

  const mockCtx: ToolContext = {
    api: fakeApi,
    account: { id: "acc-test", label: "Test", enabled: true, disabledTools: [] } as any,
    message: testMsg,
    batch: [testMsg],
    agent: { id: "ag-test", name: "Bot", disabledTools: [] } as any,
    ghiNhanDaGui: () => {},
  };

  it("tra cứu kết luận thanh tra theo từ khóa", async () => {
    const tool = createThanhtraLamdongTool(mockCtx);
    const result = (await chay(tool, { action: "search", keyword: "môi trường xanh" })) as string;

    assert.equal(typeof result, "string");
    assert.match(result, /DANH SÁCH KẾT LUẬN THANH TRA/);
    assert.match(result, /môi trường xanh Đà Lạt/i);
  });

  it("tra cứu danh sách mới nhất khi không truyền từ khóa hoặc 'mới nhất'", async () => {
    const tool = createThanhtraLamdongTool(mockCtx);
    const result = (await chay(tool, { action: "search", keyword: "mới nhất" })) as string;

    assert.equal(typeof result, "string");
    assert.match(result, /DANH SÁCH KẾT LUẬN THANH TRA/);
    assert.match(result, /ID #/);
  });

  it("xem chi tiết kết luận thanh tra theo ID", async () => {
    const tool = createThanhtraLamdongTool(mockCtx);
    const result = (await chay(tool, { action: "get", docId: 1 })) as string;

    assert.equal(typeof result, "string");
    assert.match(result, /CHI TIẾT KẾT LUẬN THANH TRA/);
    assert.match(result, /Tiêu đề/);
  });
});
