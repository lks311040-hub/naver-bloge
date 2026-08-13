import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScheduleRequestSchema, type ScheduleRecord, type ScheduleRequest } from "@app/shared";
import { createSchedule, deleteSchedule, fetchSchedules, runScheduleNow, updateSchedule } from "../api/schedules";

const EMPTY: ScheduleRequest = {
  name: "",
  cronExpression: "0 9 * * 1", // 매주 월요일 오전 9시
  timezone: "Asia/Seoul",
  title: "",
  keyword: "",
  highlightContent: "",
  enabled: true,
};

export default function Schedule() {
  const queryClient = useQueryClient();
  const schedulesQuery = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });

  const { register, handleSubmit, reset } = useForm<ScheduleRequest>({
    resolver: zodResolver(ScheduleRequestSchema),
    defaultValues: EMPTY,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedules"] });

  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      invalidate();
      reset(EMPTY);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateSchedule(id, { enabled }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({ mutationFn: deleteSchedule, onSuccess: invalidate });
  const runNowMutation = useMutation({ mutationFn: runScheduleNow });

  return (
    <div>
      <h2>예약</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        cron 표현식으로 예약을 등록하면, 실행될 때 글감 준비~AI 초안 작성까지만 자동으로 하고
        "초안" 화면에 검토 대기 상태로 쌓입니다. <strong>자동 발행은 절대 일어나지 않습니다.</strong>
      </p>

      <section>
        <h3>새 예약 등록</h3>
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}
        >
          <Field label="예약 이름">
            <input {...register("name")} placeholder="예: 매주 월요일 신규글" />
          </Field>
          <Field label="cron 표현식 (분 시 일 월 요일)">
            <input {...register("cronExpression")} placeholder="0 9 * * 1" />
          </Field>
          <Field label="시간대">
            <input {...register("timezone")} />
          </Field>
          <Field label="글 제목">
            <input {...register("title")} />
          </Field>
          <Field label="타겟 키워드 (선택)">
            <input {...register("keyword")} />
          </Field>
          <Field label="강조할 내용 (선택)">
            <textarea rows={3} {...register("highlightContent")} />
          </Field>
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
        <div style={{ color: "#6b7280", fontSize: 12 }}>{schedule.title}</div>
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
