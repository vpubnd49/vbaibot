import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { TraceStep, TraceTurnAcrossThreads } from "../dashboard-api-client";
import { api } from "../dashboard-api-client";
import { PageHeader } from "../layout/page-header";
import { IconCpu } from "../shared/dashboard-icons";
import { formatTime } from "../shared/ui-bits";
import { TraceRong, TraceStepCard } from "./trace-step-card";

/**
 * Trang Trace: các lượt agent gần đây của MỌI hội thoại.
 *
 * Vì sao có trang riêng dù đã có tab trong drawer Sessions: bản đầu chỉ đặt
 * trong drawer, user đi tìm và không thấy - tính năng chẩn đoán mà chôn sâu ba
 * lớp thì coi như không có. Ở đây bấm một cái là thấy hết, không phải nhớ lỗi
 * xảy ra ở hội thoại nào.
 *
 * Hỗ trợ mở thẳng 1 lượt qua `?turnId=` (drawer lịch sử chạy của trang Lịch
 * hẹn dùng link này để nhảy tới đúng lượt agent của 1 lần job chạy) - tách
 * hẳn khỏi state của danh sách `turns` vì lượt đó có thể đã rơi khỏi 50 lượt
 * gần nhất, không tìm cách "highlight trong list" mà tự fetch riêng.
 */
export function TracePage() {
  const [searchParams] = useSearchParams();
  const openTurnId = Number(searchParams.get("turnId"));

  const [turns, setTurns] = useState<TraceTurnAcrossThreads[]>([]);
  const [dangMo, setDangMo] = useState<number | null>(null);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");

  const [openSteps, setOpenSteps] = useState<TraceStep[]>([]);
  const [openLoading, setOpenLoading] = useState(false);

  /** Con trỏ trang sau; `null` = đã hết lượt, ẩn nút "Xem thêm" */
  const [conTro, setConTro] = useState<number | null>(null);
  const [dangTaiThem, setDangTaiThem] = useState(false);

  useEffect(() => {
    api
      .traceAll()
      .then((r) => {
        setTurns(r.turns);
        setConTro(r.nextCursor);
      })
      .catch((e: Error) => setLoi(e.message));
  }, []);

  /** Nối thêm trang lượt CŨ HƠN. Không đụng lượt đang mở ở trên. */
  async function xemThem() {
    if (conTro === null) return;
    setDangTaiThem(true);
    try {
      const r = await api.traceAll(conTro);
      setTurns((cu) => [...cu, ...r.turns]);
      setConTro(r.nextCursor);
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setDangTaiThem(false);
    }
  }

  useEffect(() => {
    if (!Number.isInteger(openTurnId) || openTurnId <= 0) return;
    setOpenLoading(true);
    api
      .traceSteps(openTurnId)
      .then((r) => setOpenSteps(r.steps))
      .catch(() => setOpenSteps([]))
      .finally(() => setOpenLoading(false));
  }, [openTurnId]);

  // Lượt ĐANG mở, đọc được ngay lúc response về. Không dùng state `dangMo` cho
  // việc này: closure của hàm bất đồng bộ giữ giá trị của lần render lúc bấm.
  const luotDangMo = useRef<number | null>(null);

  async function moLuot(turnId: number) {
    if (dangMo === turnId) {
      luotDangMo.current = null;
      setDangMo(null);
      return;
    }
    luotDangMo.current = turnId;
    setDangMo(turnId);
    setDangTai(true);
    const r = await api.traceSteps(turnId).catch(() => ({ steps: [] }));
    // Bấm lượt A rồi lượt B khi A chưa về: response A về SAU sẽ ghi đè và UI
    // hiện step của A dưới tiêu đề của B. Trên trang chẩn đoán thì nhầm lẫn đó
    // đắt - người đọc kết luận sai về đúng cái lượt họ đang truy.
    if (luotDangMo.current !== turnId) return;
    setSteps(r.steps);
    setDangTai(false);
  }

  return (
    <>
      <PageHeader
        icon={IconCpu}
        title="Truy vết suy luận (Traces)"
        subtitle="Chi tiết từng bước suy luận của mô hình AI, các công cụ đã gọi và lượng token tiêu thụ theo từng lượt trò chuyện"
      />

      {loi && (
        <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          {loi}
        </div>
      )}

      {Number.isInteger(openTurnId) && openTurnId > 0 && (
        <div className="mb-5 gc-card p-5 space-y-3">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Lượt #{openTurnId} (mở từ Lịch hẹn)
          </div>
          {openLoading && <p className="text-xs text-ink-soft">Đang nạp dữ liệu bước chạy...</p>}
          {!openLoading && openSteps.map((s, i) => <TraceStepCard key={i} step={s} />)}
          {!openLoading && openSteps.length === 0 && (
            <p className="text-xs text-ink-soft">Lượt này không có bước nào được ghi nhận.</p>
          )}
        </div>
      )}

      {turns.length === 0 && !loi && <TraceRong />}

      <div className="space-y-2.5">
        {turns.map((t) => (
          <div key={t.id}>
            <button
              type="button"
              onClick={() => moLuot(t.id)}
              className="gc-card-hover flex w-full items-center justify-between p-4 text-left transition-all"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{t.displayName}</div>
                <div className="mt-1 text-xs text-ink-soft flex items-center gap-2">
                  <span>{formatTime(t.createdAt)}</span>
                  <span>•</span>
                  <span><strong className="text-ink font-semibold">{t.stepCount}</strong> bước</span>
                  <span>•</span>
                  <span className="font-mono">{t.totalTokens.toLocaleString("vi-VN")} tokens</span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 rounded-lg border border-line bg-tile/60 px-3 py-1 hover:bg-tile">
                {dangMo === t.id ? "Thu gọn" : "Xem chi tiết"}
              </span>
            </button>

            {dangMo === t.id && (
              <div className="mt-2 space-y-2 pl-3">
                {dangTai && <p className="text-[12px] text-ink-soft">Đang tải...</p>}
                {!dangTai && steps.map((s, i) => <TraceStepCard key={i} step={s} />)}
                {!dangTai && steps.length === 0 && (
                  <p className="text-[12px] text-ink-soft">Lượt này không có step nào được ghi.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chỉ hiện khi server nói còn lượt phía sau. Bấm là NỐI THÊM, lượt đang
          mở ở trên không bị đóng lại. */}
      {conTro !== null && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void xemThem()}
            disabled={dangTaiThem}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:bg-tile disabled:opacity-50"
          >
            {dangTaiThem ? "Đang tải..." : "Xem thêm lượt cũ hơn"}
          </button>
        </div>
      )}

      {conTro === null && turns.length > 0 && (
        <p className="mt-4 text-center text-[12px] text-ink-soft/60">
          Đã hết lượt có trace. Trace cũ hơn bị dọn theo "Giữ trace" ở trang Cấu hình.
        </p>
      )}
    </>
  );
}
