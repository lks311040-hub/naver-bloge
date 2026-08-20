import { getDb } from "../../db/connection.js";
import type { BusinessProfile, BusinessProfileRecord } from "@app/shared";

interface BusinessProfileRow {
  name: string;
  address: string;
  address_url: string;
  strengths: string;
  notes: string;
  greeting: string;
  talktalk_url: string;
  reservation_url: string;
  style_sample: string;
  hashtags: string;
  attach_promo_talktalk: number;
  attach_promo_reservation: number;
  attach_promo_address: number;
  attach_info_talktalk: number;
  attach_info_reservation: number;
  attach_info_address: number;
  updated_at: string;
}

function rowToRecord(row: BusinessProfileRow): BusinessProfileRecord {
  return {
    name: row.name,
    address: row.address,
    addressUrl: row.address_url,
    strengths: row.strengths,
    notes: row.notes,
    greeting: row.greeting,
    talktalkUrl: row.talktalk_url,
    reservationUrl: row.reservation_url,
    styleSample: row.style_sample,
    hashtags: row.hashtags,
    attachments: {
      promotional: {
        talktalk: row.attach_promo_talktalk === 1,
        reservation: row.attach_promo_reservation === 1,
        address: row.attach_promo_address === 1,
      },
      informational: {
        talktalk: row.attach_info_talktalk === 1,
        reservation: row.attach_info_reservation === 1,
        address: row.attach_info_address === 1,
      },
    },
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `name, address, address_url, strengths, notes, greeting, talktalk_url,
              reservation_url, style_sample, hashtags,
              attach_promo_talktalk, attach_promo_reservation, attach_promo_address,
              attach_info_talktalk, attach_info_reservation, attach_info_address,
              updated_at`;

/** business_profile is a singleton (id fixed to 1, seeded by migration 0001). */
export function getBusinessProfile(): BusinessProfileRecord {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM business_profile WHERE id = 1`)
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
         address_url = @addressUrl,
         strengths = @strengths,
         notes = @notes,
         greeting = @greeting,
         talktalk_url = @talktalkUrl,
         reservation_url = @reservationUrl,
         style_sample = @styleSample,
         hashtags = @hashtags,
         attach_promo_talktalk = @attachPromoTalktalk,
         attach_promo_reservation = @attachPromoReservation,
         attach_promo_address = @attachPromoAddress,
         attach_info_talktalk = @attachInfoTalktalk,
         attach_info_reservation = @attachInfoReservation,
         attach_info_address = @attachInfoAddress,
         updated_at = datetime('now')
       WHERE id = 1`,
    )
    // better-sqlite3 named params must be flat primitives — the nested
    // `attachments` object is flattened here rather than passing `input` as-is.
    .run({
      name: input.name,
      address: input.address,
      addressUrl: input.addressUrl,
      strengths: input.strengths,
      notes: input.notes,
      greeting: input.greeting,
      talktalkUrl: input.talktalkUrl,
      reservationUrl: input.reservationUrl,
      styleSample: input.styleSample,
      hashtags: input.hashtags,
      attachPromoTalktalk: input.attachments.promotional.talktalk ? 1 : 0,
      attachPromoReservation: input.attachments.promotional.reservation ? 1 : 0,
      attachPromoAddress: input.attachments.promotional.address ? 1 : 0,
      attachInfoTalktalk: input.attachments.informational.talktalk ? 1 : 0,
      attachInfoReservation: input.attachments.informational.reservation ? 1 : 0,
      attachInfoAddress: input.attachments.informational.address ? 1 : 0,
    });
  return getBusinessProfile();
}
