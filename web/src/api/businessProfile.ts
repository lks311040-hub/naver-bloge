import type { BusinessProfile, BusinessProfileRecord } from "@app/shared";
import { apiFetch } from "./client";

export function fetchBusinessProfile(): Promise<BusinessProfileRecord> {
  return apiFetch<BusinessProfileRecord>("/api/business-profile");
}

export function saveBusinessProfile(data: BusinessProfile): Promise<BusinessProfileRecord> {
  return apiFetch<BusinessProfileRecord>("/api/business-profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
