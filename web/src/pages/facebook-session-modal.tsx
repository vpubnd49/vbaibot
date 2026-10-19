import { useEffect, useState } from "react";
import { ApiError } from "../dashboard-api-client";
import { facebookApi, type FacebookLoginResult, type FacebookStatus } from "../facebook-api-client";
import { Badge } from "../shared/ui-bits";
import { ChainStep, ModalField, modalButton, ToolModalShell } from "./tool-settings-modal-shell";

/**
 * Modal "Tin tức & Thời sự" -> phiên đăng nhập Facebook cá nhân cho crawler
 * fanpage (khi không có Graph API token).
 *
 * Bước 1: đăng nhập bằng email + mật khẩu (Chromium headless trên VPS). Mật
 *         khẩu chỉ gửi 1 lần, máy chủ KHÔNG lưu - chỉ lưu cookie mã hoá.
 *         FB hay bắt 2FA/duyệt đăng nhập lạ -> hiện ô nhập mã / nút kiểm tra lại.
 * Dự phòng: dán cookie export từ trình duyệt đang đăng nhập.
 */
export function FacebookSessionModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<FacebookStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [cookies, setCookies] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [step, setStep] = useState<FacebookLoginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    facebookApi
      .pending()
      .then((r) => {
        setStatus(r);
        if (r.result && (r.result.status === "need_code" || r.result.status === "need_approval")) setStep(r.result);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được trạng thái"));
  }, []);

  // Đang cào thì hỏi lại trạng thái để thấy số bài tăng
  useEffect(() => {
    if (!status?.crawlRunning) return;
    const t = setInterval(() => facebookApi.get().then(setStatus).catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [status?.crawlRunning]);

  async function run<T>(fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const r = await fn();
      after?.(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  }

  function handleResult(r: FacebookStatus & { result: FacebookLoginResult }) {
    setStatus(r);
    setStep(r.result);
    if (r.result.status === "ok") {
      setPassword("");
      setCode("");
      setStep(null);
      setInfo(`Đã đăng nhập (UID ${r.result.userId}). Bấm "Cào ngay" để lấy bài mới.`);
    } else if (r.result.status === "error") {
      setError(r.result.message);
    }
  }

  const [saveHardcoded, setSaveHardcoded] = useState(true);
  const [testing, setTesting] = useState(false);

  const s = status?.session;
  const needVerify = step?.status === "need_code" || step?.status === "need_approval" || Boolean(s?.pendingVerification);

  const sourceLabel =
    s?.source === "env"
      ? "Cấu hình cứng (.env)"
      : s?.source === "file"
        ? "Lưu cứng (data/facebook-cookie.txt)"
        : s?.source === "password"
          ? "Đăng nhập mật khẩu"
          : "Dán qua Dashboard";

  const sessionBadge = !s ? null : !s.hasSession ? (
    <Badge tone="amber">Chưa đăng nhập Facebook</Badge>
  ) : s.health.lastCheckOk === false ? (
    <Badge tone="amber">Phiên hết hạn - cần cập nhật cookie</Badge>
  ) : (
    <Badge tone="green">Đã đăng nhập · UID {s.userId} {s.isHardcoded ? `(${sourceLabel})` : ""}</Badge>
  );

  async function handleTestSession() {
    setTesting(true);
    setError("");
    setInfo("");
    try {
      const res = await facebookApi.testSession();
      setStatus(res);
      if (res.ok) {
        setInfo("Phiên Facebook đang hoạt động rất tốt! Trình duyệt VPS đã truy cập trang chủ thành công.");
      } else {
        setError(res.error || "Facebook yêu cầu đăng nhập lại (phiên không còn hợp lệ trên máy chủ Meta).");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không kiểm tra được phiên");
    } finally {
      setTesting(false);
    }
  }

  return (
    <ToolModalShell
      title="Facebook cho Tin tức"
      subtitle="Đăng nhập Facebook cá nhân để bot tự động cào bài mới từ các fanpage (Yêu Phan Thiết, Cổng TTĐT, Đà Lạt...) mà không cần Graph API token."
      onClose={onClose}
      footer={
        <>
          {s?.hasSession && (
            <button
              type="button"
              disabled={busy || testing}
              onClick={() => void handleTestSession()}
              className={modalButton.secondary}
            >
              {testing ? "Đang kiểm tra..." : "Kiểm tra phiên"}
            </button>
          )}
          {s?.hasSession && !s.isHardcoded && (
            <button type="button" disabled={busy} onClick={() => run(facebookApi.logout, setStatus)} className={modalButton.danger}>
              Xoá phiên
            </button>
          )}
          <button
            type="button"
            disabled={busy || !status || status.crawlRunning}
            onClick={() => run(facebookApi.crawlNow, (r) => { setStatus(r); setInfo("Đang cào nền - xem kết quả tại trang “Giám sát Facebook”."); })}
            className={modalButton.secondary}
          >
            {status?.crawlRunning ? "Đang cào..." : "Cào ngay"}
          </button>
          <button type="button" onClick={onClose} className={modalButton.cancel}>Đóng</button>
        </>
      }
    >
      <ChainStep index={1} title="Trạng thái" enabled>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
          {sessionBadge}
          {status && <span className="text-ink-soft">{status.totalPosts} bài trong cache · {status.pages.filter((p) => p.enabled).length} fanpage</span>}
          <a href="/facebook-monitor" className="text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Xem bài đã cào →
          </a>
        </div>
        {s?.hasSession && (
          <div className="rounded-lg border border-line bg-tile/40 px-3 py-2 text-[12px] text-ink-soft">
            <div><b>Nguồn lưu:</b> {sourceLabel}</div>
            <div><b>Cơ chế chống thoát:</b> Đang dùng Persistent Browser Profile (giữ nguyên LocalStorage & device tokens trên VPS).</div>
            {s.source === "env" && (
              <div className="mt-1 text-emerald-600 dark:text-emerald-400">
                ✓ Được cấu hình cứng từ file <code>.env</code> - không bao giờ bị mất khi restart server hoặc deploy.
              </div>
            )}
          </div>
        )}
        {s && !s.browserAvailable && (
          <p className="text-[12px] text-amber-700 dark:text-amber-300">Máy chủ chưa có Chromium - đăng nhập bằng mật khẩu sẽ không chạy, hãy dùng cách dán cookie.</p>
        )}
        {s?.health.lastError && <p className="text-[12px] text-amber-700 dark:text-amber-300">{s.health.lastError}</p>}
        {status && status.pages.length > 0 && (
          <ul className="space-y-0.5 text-[12px] text-ink-soft">
            {status.pages.filter((p) => p.enabled).map((p) => (
              <li key={p.pageId}>
                • {p.pageName}{" "}
                <span className="opacity-70">
                  {p.hasToken ? "(Graph API)" : ""} — {p.lastCrawledAt ? `cào lúc ${new Date(p.lastCrawledAt).toLocaleString("vi-VN")}` : "chưa cào"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChainStep>

      {!needVerify ? (
        <ChainStep index={2} title={s?.hasSession ? "Đăng nhập lại" : "Đăng nhập Facebook"} enabled>
          <ModalField id="fb-email" label="Email hoặc số điện thoại">
            <input id="fb-email" className="gc-input w-full" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </ModalField>
          <ModalField id="fb-pass" label="Mật khẩu" hint="Chỉ dùng 1 lần để lấy cookie phiên, máy chủ không lưu mật khẩu.">
            <input id="fb-pass" type="password" className="gc-input w-full" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </ModalField>
          <button
            type="button"
            disabled={busy || !email || !password}
            onClick={() => run(() => facebookApi.login(email, password), handleResult)}
            className={modalButton.primary}
          >
            {busy ? "Đang đăng nhập (~20 giây)..." : "Đăng nhập"}
          </button>
          <p className="text-[12px] leading-[1.6] text-amber-700 dark:text-amber-300">
            Nên dùng <b>tài khoản phụ</b>: Facebook có thể khoá tạm tài khoản bị nghi là tự động.
          </p>
        </ChainStep>
      ) : (
        <ChainStep index={2} title="Xác minh đăng nhập" enabled>
          <p className="text-[13px] leading-[1.6] text-ink">
            {step && "message" in step ? step.message : "Facebook đang chờ xác minh đăng nhập."}
          </p>
          {step && "screenshot" in step && step.screenshot && (
            <details open className="rounded-xl border border-line bg-tile/40 p-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-ink-soft">Màn hình Facebook đang hiển thị trên máy chủ</summary>
              <img src={step.screenshot} alt="Màn xác minh Facebook" className="mt-2 w-full rounded-lg border border-line" />
              {step.pageText && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-ink-soft">{step.pageText}</pre>}
            </details>
          )}
          <ModalField id="fb-code" label="Mã xác thực (nếu có)">
            <input id="fb-code" inputMode="numeric" className="gc-input w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </ModalField>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => facebookApi.verify(code || undefined), handleResult)} className={modalButton.primary}>
              {busy ? "Đang xử lý..." : code ? "Gửi mã" : "Kiểm tra lại (đã duyệt trên app)"}
            </button>
            <button type="button" disabled={busy} onClick={() => run(facebookApi.cancel, (r) => { setStatus(r); setStep(null); })} className={modalButton.cancel}>
              Huỷ
            </button>
          </div>
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-ink-soft">Không nhận được mã? Chuyển cách xác minh:</p>
            <div className="flex flex-wrap gap-2">
              <button id="fb-method-sms" type="button" disabled={busy} onClick={() => run(() => facebookApi.switchMethod("sms"), handleResult)} className={modalButton.secondary}>
                Gửi mã qua SMS
              </button>
              <button id="fb-method-app" type="button" disabled={busy} onClick={() => run(() => facebookApi.switchMethod("app"), handleResult)} className={modalButton.secondary}>
                Mã từ app xác thực
              </button>
              <button id="fb-method-device" type="button" disabled={busy} onClick={() => run(() => facebookApi.switchMethod("device"), handleResult)} className={modalButton.secondary}>
                Duyệt trên điện thoại
              </button>
              <button id="fb-method-email" type="button" disabled={busy} onClick={() => run(() => facebookApi.switchMethod("email"), handleResult)} className={modalButton.secondary}>
                Gửi mã qua email
              </button>
            </div>
          </div>
          <p className="text-[12px] text-ink-soft">
            Có 5 phút để xác minh. Nếu Facebook vẫn chặn, dùng mục 3 “Dán cookie” - cách ổn định nhất, không cần mã.
          </p>
        </ChainStep>
      )}

      <ChainStep index={3} title="Dán cookie cứng (Khuyên dùng - Không bị thoát)" enabled={showImport} onToggle={() => setShowImport((v) => !v)}>
        {showImport && (
          <>
            <div className="space-y-2 text-[12px] leading-[1.6] text-ink-soft">
              <p>
                <b>Mẹo giữ phiên lâu nhất:</b> Khi export cookie từ tiện ích <b>Cookie-Editor</b>, hãy export dạng <b>JSON</b> đầy đủ (bao gồm cả <code>datr</code>, <code>sb</code>, <code>c_user</code>, <code>xs</code>, <code>fr</code>). Meta cần các token này để xác thực trình duyệt quen thuộc.
              </p>
              <p>
                Hoặc dán chuỗi header <code>c_user=...; xs=...; datr=...; sb=...</code>.
              </p>
            </div>

            <textarea
              className="gc-input h-28 w-full font-mono text-[11px]"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder='[{"name":"c_user","value":"..."}, {"name":"xs","value":"..."}, {"name":"datr","value":"..."}]'
            />

            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink">
                <input
                  type="checkbox"
                  checked={saveHardcoded}
                  onChange={(e) => setSaveHardcoded(e.target.checked)}
                  className="rounded border-line text-blue-600 focus:ring-blue-500"
                />
                Lưu cứng vào file dữ liệu vĩnh viễn (<code>data/facebook-cookie.txt</code>)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || cookies.length < 10}
                onClick={() =>
                  run(
                    () => facebookApi.importCookies(cookies, saveHardcoded),
                    (r) => {
                      setStatus(r);
                      setCookies("");
                      setInfo(
                        saveHardcoded
                          ? "Đã lưu cứng cookie thành công! Phiên sẽ tồn tại bền vững trên VPS."
                          : "Đã lưu cookie thành công. Bấm \"Cào ngay\" để thử."
                      );
                    }
                  )
                }
                className={modalButton.secondary}
              >
                Lưu cookie {saveHardcoded ? "cứng" : ""}
              </button>
            </div>

            <div className="mt-2 rounded-xl border border-line/70 bg-tile/40 p-3 text-[11px] text-ink-soft">
              <div className="font-semibold text-ink">Cách dán cứng vào file <code>.env</code> trên VPS:</div>
              <p className="mt-1">
                Thêm dòng sau vào file <code>.env</code> ở thư mục gốc bot trên VPS:
              </p>
              <pre className="mt-1.5 overflow-x-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-100">
                FACEBOOK_COOKIE="c_user=...; xs=...; datr=...; sb=..."
              </pre>
              <p className="mt-1">
                Khi có biến này, bot sẽ luôn ưu tiên nạp cookie này, không bao giờ bị mất kể cả khi redeploy hay xoá phiên tạm.
              </p>
            </div>
          </>
        )}
      </ChainStep>

      {info && (
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-300">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </ToolModalShell>
  );
}
