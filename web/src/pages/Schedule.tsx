import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScheduleRequestSchema, type ScheduleRecord, type ScheduleRequest } from "@app/shared";
import { createSchedule, deleteSchedule, fetchSchedules, runScheduleNow, updateSchedule } from "../api/schedules";

// cron 요일: 일=0 월=1 화=2 수=3 목=4 금=5 토=6
const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
] as const;

function buildCronExpression(days: number[], time: string): string {
  const [hh, mm] = time.split(":").map((n) => Number(n));
  const dayPart = days.length > 0 ? [...days].sort().join(",") : "*";
  return `${mm || 0} ${hh || 0} * * ${dayPart}`;
}

const EMPTY: ScheduleRequest = {
  name: "",
  cronExpression: "0 9 * * 1",
  timezone: "Asia/Seoul",
  postType: "promotional",
  topicSource: "fixed",
  title: "",
  keyword: "",
  highlightContent: "",
  enabled: true,
};

export default function Schedule() {
  const queryClient = useQueryClient();
  const schedulesQuery = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });

  const [days, setDays] = useState<number[]>([1]); // 기본: 매주 월요일
  const [time, setTime] = useState("09:00");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScheduleRequest>({
    resolver: zodResolver(ScheduleRequestSchema),
    defaultValues: EMPTY,
  });
  const postType = watch("postType");
  const topicSource = watch("topicSource");
  const isQueue = topicSource === "queue";
  const isInformational = postType === "informational";

  const cronPreview = useMemo(() => buildCronExpression(days, time), [days, time]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedules"] });

  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      invalidate();
      reset(EMPTY);
      setDays([1]);
      setTime("09:00");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateSchedule(id, { enabled }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({ mutationFn: deleteSchedule, onSuccess: invalidate });
  const runNowMutation = useMutation({ mutationFn: runScheduleNow });

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <div>
      <h2>예약</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        요일과 시간을 지정해 예약을 등록하면, 그 시각에 <strong>서버(PC)가 켜져 있는 한</strong> 자동으로 글감
        준비~AI 초안 작성까지만 진행되고 "초안" 화면에 검토 대기 상태로 쌓입니다.{" "}
        <strong>자동 발행은 절대 일어나지 않습니다.</strong> PC가 꺼져 있던 시간대는 건너뛰고, 다음 켜졌을 때
        재실행되지 않습니다 — 놓친 예약은 "지금 실행" 버튼으로 직접 채울 수 있습니다.
      </p>

      <section>
        <h3>새 예약 등록</h3>
        <form
          onSubmit={handleSubmit((data) => {
            const cronExpression = buildCronExpression(days, time);
            createMutation.mutate({ ...data, cronExpression });
          })}
          style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}
        >
          <Field label="예약 이름">
            <input {...register("name")} placeholder="예: 월수금일 정보성 글" />
          </Field>

          <Field label="요일">
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  onClick={(e) => {
                    // Handle the toggle ourselves on the whole label (not just
                    // the native checkbox's onChange) — the native checkbox
                    // default-toggle didn't reliably fire from every click
                    // source, so this doesn't depend on it at all.
                    e.preventDefault();
                    toggleDay(d.value);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 400,
                    padding: "4px 8px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    cursor: "pointer",
                    userSelect: "none",
                    background: days.includes(d.value) ? "#eef2ff" : undefined,
                  }}
                >
                  <input type="checkbox" checked={days.includes(d.value)} readOnly style={{ margin: 0 }} />
                  {d.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="시각">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>

          <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>
            cron: {cronPreview} ({watch("timezone")})
          </p>

          <Field label="예약 종류">
            <div style={{ display: "flex", gap: 16 }}>
              <label
                onClick={(e) => {
                  e.preventDefault();
                  setValue("topicSource", "fixed");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer", userSelect: "none" }}
              >
                <input type="radio" checked={topicSource === "fixed"} readOnly />
                고정 주제 (홍보성/정보성, 매번 같은 제목·키워드)
              </label>
              <label
                onClick={(e) => {
                  e.preventDefault();
                  setValue("topicSource", "queue");
                  setValue("postType", "informational");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer", userSelect: "none" }}
              >
                <input type="radio" checked={topicSource === "queue"} readOnly />
                글감 큐 사용 (정보성, 매번 새 주제)
              </label>
            </div>
          </Field>

          {isQueue && (
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              실행될 때마다 "글감 메모장"에서 오래된 순으로 하나씩 주제를 꺼내 정보성 글을 씁니다. 메모장이
              비어 있으면 AI가 최근 글과 겹치지 않는 새 주제를 스스로 골라 씁니다. 아래 제목/키워드 입력은
              무시됩니다.
            </p>
          )}

          {!isQueue && (
            <>
              <Field label="글 종류">
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input type="radio" value="promotional" {...register("postType")} />
                    홍보성 글
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input type="radio" value="informational" {...register("postType")} />
                    정보성 글
                  </label>
                </div>
              </Field>

              {!isInformational && (
                <Field label="글 제목">
                  <input {...register("title")} />
                  {errors.title && <span className="status-pill error">{errors.title.message}</span>}
                </Field>
              )}
              <Field label={isInformational ? "주제 키워드" : "타겟 키워드 (선택)"}>
                <input {...register("keyword")} />
                {errors.keyword && <span className="status-pill error">{errors.keyword.message}</span>}
              </Field>
              <Field label="강조할 내용 (선택)">
                <textarea rows={3} {...register("highlightContent")} />
              </Field>
            </>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input type="checkbox" {...register("enabled")} defaultChecked />
            활성화
          </label>
          <div>
            <button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "등록 중..." : "예약 등록"}
            </button>
            {createMutation.isError && (
              <span className="status-pill error" style={{ marginLeft: 12 }}>
                {String(createMutation.error)}
              </span>
            )}
          </div>
        </form>
      </section>

      <section>
        <h3>등록된 예약</h3>
        {schedulesQuery.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}
        {schedulesQuery.data && schedulesQuery.data.length === 0 && (
          <p style={{ color: "#6b7280" }}>등록된 예약이 없습니다.</p>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {schedulesQuery.data?.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                onToggle={(enabled) => toggleMutation.mutate({ id: s.id, enabled })}
                onDelete={() => deleteMutation.mutate(s.id)}
                onRunNow={() => runNowMutation.mutate(s.id)}
                runNowPending={runNowMutation.isPending && runNowMutation.variables === s.id}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const POST_TYPE_LABEL: Record<string, string> = { promotional: "홍보성", informational: "정보성" };

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
  onRunNow,
  runNowPending,
}: {
  schedule: ScheduleRecord;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onRunNow: () => void;
  runNowPending: boolean;
}) {
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: "10px 4px" }}>
        <strong>{schedule.name}</strong>
        <div style={{ color: "#6b7280", fontSize: 12 }}>
          {POST_TYPE_LABEL[schedule.postType]} ·{" "}
          {schedule.topicSource === "queue" ? "글감 큐 사용" : schedule.title || schedule.keyword}
        </div>
      </td>
      <td style={{ padding: "10px 4px", color: "#6b7280" }}>
        {schedule.cronExpression} ({schedule.timezone})
      </td>
      <td style={{ padding: "10px 4px", color: "#6b7280" }}>
        {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString("ko-KR") : "실행 이력 없음"}
      </td>
      <td style={{ padding: "10px 4px" }}>
        <span className={`status-pill ${schedule.enabled ? "ok" : ""}`}>
          {schedule.enabled ? "활성" : "비활성"}
        </span>
      </td>
      <td style={{ padding: "10px 4px", whiteSpace: "nowrap" }}>
        <button type="button" onClick={() => onToggle(!schedule.enabled)}>
          {schedule.enabled ? "끄기" : "켜기"}
        </button>{" "}
        <button type="button" onClick={onRunNow} disabled={runNowPending}>
          {runNowPending ? "실행 중..." : "지금 실행"}
        </button>{" "}
        <button type="button" onClick={onDelete}>
          삭제
        </button>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      {children}
    </label>
  );
}
