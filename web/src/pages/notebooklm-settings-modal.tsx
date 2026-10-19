import { useEffect, useRef, useState } from "react";
import { ApiError } from "../dashboard-api-client";
import { notebooklmApi, NOVNC_URL, type NotebooklmStatus } from "../notebooklm-api-client";
import { Badge, ToggleKnob } from "../shared/ui-bits";
import { ChainStep, ModalField, modalButton, ToolModalShell } from "./tool-settings-modal-shell";

/**
 * Modal cấu hình NotebookLM, mở từ nút Settings trên dòng tool "NotebookLM".
 *
 * Ngoài các công tắc/trần lượt còn có bước ĐĂNG NHẬP GOOGLE ngay trong
 * dashboard: bấm nút -> máy chủ mở Chrome -> tab mới hiện màn hình Chrome đó
 * (noVNC qua proxy có kiểm phiên dashboard) để Admin đăng nhập tài khoản
 * Google riêng của bot. Trạng thái tự làm mới 5 giây/lần trong lúc chờ.
 */

export function NotebooklmSettingsModal({
  status: initial,
  onClose,
  onSaved,
}: {
  status: NotebooklmStatus;
  onClose: () => void;
  onSaved: (next: NotebooklmStatus) => void;
}) {
  const [status, setStatus] = useState(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [publicAccess, setPublicAccess] = useState(initial.publicAccess);
  const [maxPerDay, setMaxPerDay] = useState(String(initial.maxPerDay));
  const [maxGlobal, setMaxGlobal] = useState(String(initial.maxPerDayGlobal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const waiting = status.login.running || (!status.server.authenticated && status.server.online);

  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // Đang chờ đăng nhập Google thì hỏi lại trạng thái liên tục để thấy ngay khi xong
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      notebooklmApi.get().then((s) => {
        setStatus(s);
        onSavedRef.current(s);
      }).catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [waiting]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await notebooklmApi.update({
        enabled,
        publicAccess,
        maxPerDay: Number(maxPerDay) || 0,
        maxPerDayGlobal: Number(maxGlobal) || 0,
      });
      onSaved(res);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle() {
    setError("");
    // Mở tab NGAY trong sự kiện bấm - mở sau await thì trình duyệt chặn popup
    const tab = window.open(NOVNC_URL, "_blank");
    try {
      const res = await notebooklmApi.login();
      setStatus((s) => ({ ...s, login: res.login }));
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : "Không mở được trình đăng nhập");
    }
  }

  const srv = status.server;
  const serverBadge = !srv.online
    ? <Badge tone="amber">Máy chủ đang tắt</Badge>
    : srv.authenticated
      ? <Badge tone="green">Đã đăng nhập Google</Badge>
      : <Badge tone="amber">Chưa đăng nhập Google</Badge>;

  return (
    <ToolModalShell
      title="Gemini Notebook (NotebookLM)"
      subtitle="Google đã đổi tên NotebookLM thành Gemini Notebook (notebook.google.com). Mỗi cuộc chat một sổ tay riêng: nạp file/link, hỏi đáp có trích dẫn, tạo slides, podcast, video, infographic, báo cáo."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={modalButton.cancel}>Hủy</button>
          <button type="button" onClick={save} disabled={busy} className={modalButton.primary}>
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      <ChainStep index={1} title="Máy chủ & tài khoản Google" enabled>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
          {serverBadge}
          <span className="text-ink-soft">
            Hôm nay đã tạo {status.usedToday} lượt · {status.notebooks} notebook
          </span>
        </div>
        {!srv.online && srv.error && <p className="text-[12px] text-amber-700 dark:text-amber-300">{srv.error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={loginGoogle} disabled={!srv.online || status.login.running} className={modalButton.secondary}>
            {status.login.running ? "Đang chờ đăng nhập..." : srv.authenticated ? "Đăng nhập lại Google" : "Đăng nhập Google"}
          </button>
          {status.login.running && (
            <a href={NOVNC_URL} target="_blank" rel="noreferrer" className="text-[13px] text-zalo-600 hover:underline">
              Mở lại màn hình Chrome
            </a>
          )}
        </div>
        <p className="text-[12px] leading-[1.6] text-ink-soft">
          Tab mới hiện Chrome của máy chủ. Đăng nhập <b>tài khoản Google riêng của bot</b> (có 10 phút), xong Chrome tự đóng và trạng thái chuyển xanh.
          {status.login.result && status.login.result !== "ok" && ` Lần trước: ${status.login.result}.`}
        </p>
      </ChainStep>

      <ChainStep index={2} title="Bật cho bot" enabled={enabled} onToggle={() => setEnabled((v) => !v)}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-ink">
            Mọi người dùng được
            <p className="text-[12px] text-ink-soft">Tắt = chỉ Admin (adminUserIds) dùng được.</p>
          </div>
          <button type="button" onClick={() => setPublicAccess((v) => !v)} aria-label="Bật tắt mọi người dùng được" className="shrink-0">
            <ToggleKnob on={publicAccess} />
          </button>
        </div>
      </ChainStep>

      <ChainStep index={3} title="Trần lượt tạo mỗi ngày" enabled>
        <div className="grid grid-cols-2 gap-3">
          <ModalField id="nlm-max-chat" label="Mỗi cuộc chat">
            <input id="nlm-max-chat" type="number" min={0} max={100} className="gc-input w-full" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} />
          </ModalField>
          <ModalField id="nlm-max-global" label="Toàn bot">
            <input id="nlm-max-global" type="number" min={0} max={500} className="gc-input w-full" value={maxGlobal} onChange={(e) => setMaxGlobal(e.target.value)} />
          </ModalField>
        </div>
        <p className="text-[12px] leading-[1.6] text-ink-soft">
          Chỉ tính lượt TẠO podcast/video/infographic/báo cáo; hỏi đáp và nạp nguồn không tính. Lượt hỏng được hoàn. 0 = không giới hạn.
        </p>
      </ChainStep>

      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </ToolModalShell>
  );
}
