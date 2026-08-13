import { getDb } from "../../db/connection.js";
import type { BusinessProfile, BusinessProfileRecord } from "@app/shared";

interface BusinessProfileRow {
  name: string;
  address: string;
  strengths: string;
  notes: string;
  greeting: string;
  talktalk_url: string;
  reservation_url: string;
  style_sample: string;
  hashtags: string;
  updated_at: string;
}

function rowToRecord(row: BusinessProfileRow): BusinessProfileRecord {
  return {
    name: row.name,
    address: row.address,
    strengths: row.strengths,
    notes: row.notes,
    greeting: row.greeting,
    talktalkUrl: row.talktalk_url,
    reservationUrl: row.reservation_url,
    styleSample: row.style_sample,
    hashtags: row.hashtags,
    updatedAt: row.updated_at,
  };
}

/** business_profile is a singleton (id fixed to 1, seeded by migration 0001). */
export function getBusinessProfile(): BusinessProfileRecord {
  const row = getDb()
    .prepare(
      `SELECT name, address, strengths, notes, greeting, talktalk_url,
              reservation_url, style_sample, hashtags, updated_at
       FROM business_profile WHERE id = 1`,
    )
    .get() as BusinessProfileRow | undefined;

  if (!row) {
    throw new Error("business_profile singleton row missing — migrations did not seed it");
  }
  return rowToRecord(row);
}

export function updateBusinessProfile(input: BusinessProfile): BusinessProfileRecord {
  getDb()
    .prepare(
      `UPDATE business_profile SET
         name = @name,
         address = @address,
         strengths = @strengths,
         notes = @notes,
         greeting = @greeting,
         talktalk_url = @talktalkUrl,
         reservation_url = @reservationUrl,
         style_sample = @styleSample,
         hashtags = @hashtags,
         updated_at = datetime('now')
       WHERE id = 1`,
    )
    .run(input);
  return getBusinessProfile();
}
