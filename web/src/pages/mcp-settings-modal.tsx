import { useEffect, useState } from "react";
import type { McpServerItem } from "../dashboard-api-client";
import { api, ApiError } from "../dashboard-api-client";
import { ToggleKnob } from "../shared/ui-bits";
import { ModalField, modalButton, ToolModalShell } from "./tool-settings-modal-shell";

export function McpSettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "green" | "red" | "blue"; text: string } | null>(null);

  // Form thêm / sửa server
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  function reload() {
    setLoading(true);
    api.listMcpServers()
      .then((res: { items: McpServerItem[] }) => {
        setServers(res.items);
      })
      .catch((err) => {
        setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Không tải được danh sách MCP server" });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setBaseUrl("");
    setApiKey("");
    setEnabled(true);
    setShowAddForm(false);
    setStatus(null);
  }

  function startEdit(server: McpServerItem) {
    setEditingId(server.id);
    setName(server.name);
    setBaseUrl(server.baseUrl);
    setApiKey(""); // Không điền key cũ để bảo mật
    setEnabled(server.enabled);
    setShowAddForm(true);
    setStatus(null);
  }

  async function saveServer() {
    if (!name.trim()) {
      setStatus({ tone: "red", text: "Vui lòng nhập tên gợi nhớ cho Server" });
      return;
    }
    if (!baseUrl.trim()) {
      setStatus({ tone: "red", text: "Vui lòng nhập URL của MCP Server" });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      await api.saveMcpServer({
        id: editingId || undefined,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        enabled,
      });
      resetForm();
      reload();
      onSaved();
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Lưu thất bại" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteServer(id: string, serverName: string) {
    if (!confirm(`Bạn có chắc muốn xóa MCP server "${serverName}"?`)) return;
    setBusy(true);
    try {
      await api.deleteMcpServer(id);
      reload();
      onSaved();
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Xóa thất bại" });
    } finally {
      setBusy(false);
    }
  }

  async function testServer(url: string, key?: string) {
    if (!url.trim()) return;
    setBusy(true);
    setStatus({ tone: "blue", text: `Đang kết nối tới ${url}...` });
    try {
      const res = await api.testMcpServer({
        baseUrl: url.trim(),
        apiKey: key?.trim() || undefined,
      });
      if (res.ok) {
        setStatus({
          tone: "green",
          text: `Kết nối thành công! Server cung cấp ${res.toolsCount ?? 0} tool(s): ${(res.tools || []).join(", ") || "(chưa có tool nào)"}`,
        });
      } else {
        setStatus({ tone: "red", text: `Lỗi kết nối: ${res.error || "Không phản hồi"}` });
      }
    } catch (err) {
      setStatus({ tone: "red", text: err instanceof ApiError ? err.message : "Lỗi kết nối" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModalShell
      title="Cài đặt MCP Client (mcp_client)"
      subtitle="Kết nối MCP servers ngoài qua Model Context Protocol để AI gọi công cụ mở rộng."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className={modalButton.cancel}
        >
          Đóng
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-tile p-3 text-[12px] leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">🔌 Model Context Protocol (MCP):</p>
          <p className="mt-1">
            MCP Client cho phép bot kết nối tới các dịch vụ MCP Server bên ngoài qua giao thức HTTP / JSON-RPC để mở rộng năng lực (tra cứu dữ liệu chuyên ngành, gọi API hệ thống, v.v.).
          </p>
        </div>

        {status && (
          <div
            className={`rounded-xl border px-4 py-2.5 text-[13px] ${
              status.tone === "green"
                ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : status.tone === "red"
                ? "border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                : "border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
            }`}
          >
            {status.text}
          </div>
        )}

        {showAddForm ? (
          <div className="space-y-3 rounded-xl border border-line bg-tile p-4">
            <h4 className="text-[14px] font-semibold text-ink">
              {editingId ? "Chỉnh sửa MCP Server" : "Thêm MCP Server Mới"}
            </h4>

            <ModalField id="mcp-name" label="Tên gợi nhớ của Server">
              <input
                id="mcp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: NotebookLM MCP Server, Local Tools..."
                disabled={busy}
                className="gc-input w-full"
              />
            </ModalField>

            <ModalField id="mcp-url" label="URL Server (Base URL)">
              <input
                id="mcp-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:3000 hoặc https://mcp.domain.com"
                disabled={busy}
                className="gc-input w-full"
              />
            </ModalField>

            <ModalField id="mcp-key" label="API Key / Bearer Token (Nếu server yêu cầu)">
              <input
                id="mcp-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editingId ? "Bỏ trống nếu không đổi key" : "Nhập token xác thực..."}
                disabled={busy}
                className="gc-input w-full"
              />
            </ModalField>

            <div className="flex items-center justify-between rounded-lg bg-surface p-3">
              <span className="text-[13px] font-medium text-ink">Bật máy chủ này</span>
              <button type="button" onClick={() => setEnabled(!enabled)} disabled={busy}>
                <ToggleKnob on={enabled} />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => testServer(baseUrl, apiKey)}
                disabled={busy || !baseUrl.trim()}
                className={modalButton.secondary}
              >
                Kiểm tra kết nối
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className={modalButton.cancel}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveServer}
                disabled={busy}
                className={modalButton.primary}
              >
                Lưu Server
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink">Danh sách MCP Servers ({servers.length})</span>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className={modalButton.primary}
            >
              + Thêm MCP Server
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-4 text-center text-ink-soft">Đang tải danh sách server...</p>
        ) : servers.length === 0 && !showAddForm ? (
          <div className="rounded-xl border border-dashed border-line p-6 text-center text-[13px] text-ink-soft">
            <p>Chưa có MCP server nào được cấu hình.</p>
            <p className="mt-1 text-[12px]">Bấm "+ Thêm MCP Server" để kết nối server đầu tiên.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-tile p-3 text-[13px]"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{s.name}</span>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        s.enabled ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                    <span className="text-[11px] text-ink-soft">
                      {s.enabled ? "Đang bật" : "Đã tắt"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink-soft">{s.baseUrl}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => testServer(s.baseUrl)}
                    disabled={busy}
                    className="rounded px-2 py-1 text-[12px] text-ink-soft hover:bg-tile hover:text-ink"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    disabled={busy}
                    className="rounded px-2 py-1 text-[12px] text-accent hover:bg-accent/10"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteServer(s.id, s.name)}
                    disabled={busy}
                    className="rounded px-2 py-1 text-[12px] text-rose-500 hover:bg-rose-500/10"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolModalShell>
  );
}
