import { useEffect, type ReactNode } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessProfileSchema, DEFAULT_ATTACHMENTS, type BusinessProfile } from "@app/shared";
import { fetchBusinessProfile, saveBusinessProfile } from "../api/businessProfile";
import AttachmentDashboard from "./AttachmentDashboard";

const EMPTY: BusinessProfile = {
  name: "",
  address: "",
  addressUrl: "",
  strengths: "",
  notes: "",
  greeting: "",
  talktalkUrl: "",
  reservationUrl: "",
  styleSample: "",
  hashtags: "",
  attachments: DEFAULT_ATTACHMENTS,
};

const FIELD_ROWS = 3;

export default function BusinessProfileForm() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["business-profile"], queryFn: fetchBusinessProfile });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { isDirty, isSubmitSuccessful, errors },
  } = useForm({
    // No zodResolver — see Schedule.tsx for why. Validated by hand below.
    defaultValues: EMPTY,
  });

  // Populate the form once the singleton profile loads. Only reset when we
  // haven't made local edits yet, so a slow refetch never clobbers typing.
  useEffect(() => {
    if (profileQuery.data && !isDirty) {
      const { updatedAt: _updatedAt, ...rest } = profileQuery.data;
      reset(rest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: saveBusinessProfile,
    onSuccess: (record) => {
      queryClient.setQueryData(["business-profile"], record);
      const { updatedAt: _updatedAt, ...rest } = record;
      reset(rest); // clears isDirty so the "저장됨" state is accurate
    },
  });

  if (profileQuery.isLoading) {
    return <p style={{ color: "#6b7280" }}>업체 정보를 불러오는 중...</p>;
  }
  if (profileQuery.isError) {
    return <p className="status-pill error">업체 정보를 불러오지 못했습니다: {String(profileQuery.error)}</p>;
  }

  return (
    <form
      onSubmit={handleSubmit((data) => {
        clearErrors();
        const parsed = BusinessProfileSchema.safeParse(data);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (typeof field === "string") {
              setError(field as FieldPath<typeof data>, { type: "custom", message: issue.message });
            }
          }
          return;
        }
        mutation.mutate(parsed.data);
      })}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}
    >
      <Field label="업체/학원 이름">
        <input {...register("name")} />
      </Field>
      <Field label="위치 (정확한 주소)">
        <input {...register("address")} placeholder="예: 서울특별시 강남구 테헤란로 123" />
      </Field>
      <Field label="특징/강점 (사실만)">
        <textarea rows={FIELD_ROWS} {...register("strengths")} />
      </Field>
      <Field label="참고사항 (선택)">
        <textarea rows={FIELD_ROWS} {...register("notes")} />
      </Field>
      <Field label="블로그 인사말 (매 글 첫 문장으로 고정 삽입)">
        <textarea rows={FIELD_ROWS} {...register("greeting")} />
      </Field>
      <Field label="네이버 톡톡 URL">
        <input {...register("talktalkUrl")} placeholder="https://talk.naver.com/..." />
      </Field>
      <Field label="네이버 예약(플레이스) 링크">
        <input {...register("reservationUrl")} placeholder="https://booking.naver.com/..." />
      </Field>
      <Field label="주소 링크 (네이버 지도/플레이스 — 글에 '오시는 길'로 붙습니다)">
        <input {...register("addressUrl")} placeholder="https://naver.me/..." />
      </Field>

      <AttachmentDashboard
        value={watch("attachments")}
        onChange={(next) => setValue("attachments", next, { shouldDirty: true })}
        urls={{
          talktalk: watch("talktalkUrl"),
          reservation: watch("reservationUrl"),
          address: watch("addressUrl"),
        }}
      />
      <Field label="내 말투 샘플 (선택 — 예전 블로그 글을 붙여넣으면 참고)">
        <textarea rows={6} {...register("styleSample")} />
      </Field>
      <Field label="항상 붙일 해시태그 세트 (공백으로 구분)">
        <input {...register("hashtags")} placeholder="#강남영어학원 #초등영어 #원어민수업" />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "저장 중..." : "저장"}
        </button>
        {isSubmitSuccessful && !isDirty && !mutation.isPending && (
          <span className="status-pill ok">저장됨</span>
        )}
        {mutation.isError && (
          <span className="status-pill error">저장 실패: {String(mutation.error)}</span>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
