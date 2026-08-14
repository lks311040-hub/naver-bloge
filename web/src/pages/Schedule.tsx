import { useMemo, useState, type ReactNode } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScheduleRequestSchema, type PostType, type ScheduleRecord, type ScheduleRequest } from "@app/shared";
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

const POST_TYPE_LABEL: Record<PostType, string> = { promotional: "홍보성", informational: "정보성" };

function buildCronExpression(days: number[], time: string): string {
  const [hh, mm] = time.split(":").map((n) => Number(n));
  const dayPart = days.length > 0 ? [...days].sort().join(",") : "*";
  return `${mm || 0} ${hh || 0} * * ${dayPart}`;
}

const EMPTY: Omit<ScheduleRequest, "postTypes"> = {
  name: "",
  cronExpression: "0 9 * * 1",
  timezone: "Asia/Seoul",
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
  const [postTypes, setPostTypes] = useState<PostType[]>(["promotional"]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    // Deliberately no zodResolver here — @hookform/resolvers' zod adapter
    // was silently failing to surface superRefine-based custom errors with
    // this project's zod v4 (validation correctly blocked bad submits, but
    // formState.errors never populated, so the submit button looked
    // "stuck" with zero feedback). Validating by hand with safeParse() in
    // the submit handler below and feeding results through setError() is
    // more code but behaves exactly as expected either way.
    defaultValues: { ...EMPTY, postTypes },
  });
  const topicSource = watch("topicSource");
  const isQueue = topicSource === "queue";
  // Fixed 모드는 항상 정확히 1개만 허용되므로 (스키마가 강제) 이 경우
  // postTypes[0]만 보면 된다.
  const singleType = postTypes[0] ?? "promotional";
  const isInformational = singleType === "informational";

  const cronPreview = useMemo(() => buildCronExpression(days, time), [days, time]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedules"] });

  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      invalidate();
      reset({ ...EMPTY, postTypes: ["promotional"] });
      setDays([1]);
      setTime("09:00");
      setPostTypes(["promotional"]);
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

  const togglePostType = (pt: PostType) => {
    setPostTypes((prev) => {
      const next = prev.includes(pt) ? prev.filter((x) => x !== pt) : [...prev, pt];
      if (next.length === 0) return prev; // 최소 1개는 유지
      // 2개를 고르면 "고정 주제"는 의미가 없으니(제목/키워드를 하나로
      // 정할 수 없음) 자동으로 "글감 큐"로 전환해준다.
      if (next.length > 1 && topicSource === "fixed") setValue("topicSource", "queue");
      return next;
    });
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
            clearErrors();
            const cronExpression = buildCronExpression(days, time);
            const parsed = ScheduleRequestSchema.safeParse({ ...data, postTypes, cronExpression });
            if (!parsed.success) {
              for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (typeof field === "string") {
                  setError(field as FieldPath<typeof data>, { type: "custom", message: issue.message });
                }
              }
              return;
            }
            createMutation.mutate(parsed.data);
          })}
          style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}
        >
          <Field label="예약 이름">
            <input {...register("name")} placeholder="예: 월수금일 정보성 글" />
            {errors.name && <span className="status-pill error">{String(errors.name.message)}</span>}
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

          <Field label="글 종류 (2개 다 고르면 실행마다 번갈아가며 발행)">
            <div style={{ display: "flex", gap: 16 }}>
              {(["promotional", "informational"] as const).map((pt) => (
                <label
                  key={pt}
                  onClick={(e) => {
                    e.preventDefault();
                    togglePostType(pt);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer", userSelect: "none" }}
                >
                  <input type="checkbox" checked={postTypes.includes(pt)} readOnly />
                  {POST_TYPE_LABEL[pt]} 글
                </label>
              ))}
            </div>
          </Field>

          <Field label="주제를 어떻게 정할지">
            <div style={{ display: "flex", gap: 16 }}>
              <label
                onClick={(e) => {
                  e.preventDefault();
                  if (postTypes.length > 1) return; // 2개 선택 시 고정 주제 비활성
                  setValue("topicSource", "fixed");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 400,
                  cursor: postTypes.length > 1 ? "not-allowed" : "pointer",
                  userSelect: "none",
                  opacity: postTypes.length > 1 ? 0.5 : 1,
                }}
              >
                <input type="radio" checked={topicSource === "fixed"} readOnly disabled={postTypes.length > 1} />
                고정 주제 직접 입력
              </label>
              <label
                onClick={(e) => {
                  e.preventDefault();
                  setValue("topicSource", "queue");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer", userSelect: "none" }}
              >
                <input type="radio" checked={topicSource === "queue"} readOnly />
                글감 큐에서 매번 새로
              </label>
            </div>
            {postTypes.length > 1 && topicSource === "fixed" && (
              <span style={{ color: "#9ca3af", fontSize: 12 }}>글 종류를 2개 선택하면 글감 큐만 쓸 수 있어요.</span>
            )}
          </Field>

          {isQueue ? (
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              실행될 때마다{" "}
              {postTypes.length > 1 ? (
                <>
                  <strong>홍보성 ↔ 정보성을 번갈아가며(라운드로빈)</strong> 각각의 "글감 메모장" 큐에서 하나씩
                  꺼내 씁니다.
                </>
              ) : (
                <>
                  "글감 메모장"에 등록된 <strong>{POST_TYPE_LABEL[singleType]}</strong> 글감 중 오래된 순으로
                  하나씩 꺼내 씁니다{isInformational ? " (AI가 이 글감을 주제로 삼아 제목을 새로 짓습니다)" : " (이 글감이 글 제목으로 그대로 쓰입니다)"}.
                </>
              )}{" "}
              해당 글감이 다 떨어지면 AI가 최근 글과 겹치지 않는 새 주제/제목을 스스로 골라 씁니다.
            </p>
          ) : (
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              아래에 직접 입력한 내용으로, 이 예약이 실행될 때마다{" "}
              <strong>{isInformational ? "매번 정확히 똑같은 주제로" : "매번 정확히 똑같은 제목으로"}</strong> 글을
              씁니다. 보통은 위에서 "글감 큐에서 매번 새로"를 고르는 편이 낫고, 이건 매번 똑같은 문구가 필요한 정기
              공지 같은 경우에만 쓰세요.
            </p>
          )}

          {!isQueue && (
            <>
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

          {Object.keys(errors).length > 0 && (
            <p style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>
              입력을 확인해주세요:{" "}
              {Object.values(errors)
                .map((e) => e?.message)
                .filter(Boolean)
                .join(" / ")}
            </p>
          )}

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
          {schedule.postTypes.map((pt) => POST_TYPE_LABEL[pt]).join(" ↔ ")} ·{" "}
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
