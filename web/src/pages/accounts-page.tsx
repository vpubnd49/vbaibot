import { useCallback, useEffect, useState } from "react";
import type { ManagedAccount, ManagedAgent } from "../dashboard-api-client";
import { api, ApiError } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconPlus, IconSignal } from "../shared/dashboard-icons";
import { useConfirmDialog } from "../shared/confirm-dialog";
import { Badge, InitialAvatar, ToggleKnob } from "../shared/ui-bits";
import { AccountEditDrawer } from "./account-edit-drawer";
import { QrLoginModal } from "./qr-login-modal";

/** Trang Accounts: tài khoản Zalo (kênh) - thêm, đổi tên, bật/tắt, gắn não, login QR */
export function AccountsPage() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [editing, setEditing] = useState<ManagedAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [qrAccount, setQrAccount] = useState<ManagedAccount | null>(null);
  const [notice, setNotice] = useState<{ tone: "red" | "amber"; text: string } | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const reload = useCallback(async () => {
    const [accs, ags] = await Promise.all([api.accountsAdmin.list(), api.agentsAdmin.list()]);
    setAccounts(accs.items);
    setAgents(ags.items);
  }, []);

  useEffect(() => {
    reload().catch(() => setNotice({ tone: "red", text: "Không tải được danh sách" }));
  }, [reload]);

  async function toggleEnabled(acc: ManagedAccount) {
    setNotice(null);
    const result = await api.accountsAdmin.update(acc.id, { enabled: !acc.enabled });
    if (result.warning) setNotice({ tone: "amber", text: result.warning });
    await reload();
  }

  async function remove(acc: ManagedAccount) {
    const ok = await confirm({
      title: `Xóa account "${acc.label}"?`,
      message: "Credentials đăng nhập Zalo sẽ bị xóa, lịch sử hội thoại vẫn giữ lại.",
    });
    if (!ok) return;
    setNotice(null);
    try {
      await api.accountsAdmin.remove(acc.id);
      await reload();
    } catch (err) {
      setNotice({ tone: "red", text: err instanceof ApiError ? err.message : "Xóa thất bại" });
    }
  }

  const agentName = (id: string) => agents.find((a) => a.id === id);

  return (
    <div>
      <PageHeader
        icon={IconSignal}
        title="Tài khoản Zalo"
        subtitle="Quản lý các tài khoản Zalo của bot, phân bổ Agent thông minh và chính sách hoạt động"
        aside={
          <button
            onClick={() => setCreating(true)}
            className="gc-button-primary text-xs py-2 px-3.5"
          >
            <IconPlus size={15} />
            <span>Thêm tài khoản</span>
          </button>
        }
      />

      {notice && (
        <div className={`mb-4 rounded-xl border p-3.5 text-xs font-medium ${
          notice.tone === "red"
            ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}>
          {notice.text}
        </div>
      )}

      <div className="space-y-3.5">
        {accounts.length === 0 && (
          <div className="gc-card p-12 text-center text-ink-soft">
            Chưa có tài khoản nào được kết nối. Bấm "Thêm tài khoản" rồi quét mã QR để đưa bot lên sóng.
          </div>
        )}
        {accounts.map((acc) => {
          const agent = agentName(acc.agentId);
          return (
            <div key={acc.id} className="gc-card-hover flex flex-wrap items-center gap-4 p-5 relative overflow-hidden group">
              <InitialAvatar name={acc.label} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-bold text-ink text-sm sm:text-base">{acc.label}</span>
                  {acc.running ? (
                    <Badge tone="green" dot>Đang kết nối</Badge>
                  ) : acc.hasCredentials ? (
                    <Badge tone="gray" dot={false}>Đã lưu phiên</Badge>
                  ) : (
                    <Badge tone="amber" dot>Chờ quét QR</Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-ink-soft flex items-center gap-2">
                  <span className="font-mono">{acc.id}</span>
                  <span>•</span>
                  <span>Não AI: <strong className="text-ink font-semibold">{agent ? `${agent.icon} ${agent.name}` : acc.agentId}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => toggleEnabled(acc)}
                  title={acc.enabled ? "Bot đang hoạt động - Bấm để tạm dừng" : "Bot đang tắt - Bấm để kích hoạt"}
                  className="flex items-center gap-1.5"
                >
                  <ToggleKnob on={acc.enabled} />
                </button>

                <button
                  onClick={() => setQrAccount(acc)}
                  className="gc-button-secondary text-xs py-1.5 px-3 font-semibold text-blue-600 dark:text-blue-400 border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10"
                >
                  Quét QR
                </button>
                <button
                  onClick={() => setEditing(acc)}
                  className="gc-button-secondary text-xs py-1.5 px-3 font-semibold"
                >
                  Cấu hình
                </button>
                <button
                  onClick={() => remove(acc)}
                  className="rounded-xl border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(editing || creating) && (
        <AccountEditDrawer
          account={editing}
          agents={agents}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            void reload();
          }}
        />
      )}

      {qrAccount && (
        <QrLoginModal
          account={qrAccount}
          onClose={() => {
            setQrAccount(null);
            void reload();
          }}
        />
      )}

      {confirmDialog}
    </div>
  );
}
