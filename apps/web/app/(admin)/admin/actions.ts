"use server";

import { revalidatePath } from "next/cache";
import { createEntity } from "@gns/core";
import { requireCapability } from "@/lib/auth/session";

/** Create an entity from the admin form (M1, BR-ENT-*). Admin/Partner only. */
export async function createEntityAction(formData: FormData): Promise<void> {
  const session = requireCapability("configure_entities");
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  await createEntity(session, {
    code: get("code"),
    legalName: get("legalName"),
    tradingName: get("tradingName") || undefined,
    address: {
      line1: get("addressLine1"),
      city: get("city"),
      postcode: get("postcode"),
      country: "United Kingdom",
    },
    signatory: { name: get("signatoryName"), role: get("signatoryRole") },
    amlSupervisor: { body: get("amlBody"), registrationNumber: get("amlReg") },
  });

  revalidatePath("/admin");
}
