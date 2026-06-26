import { z } from "zod";
import { getDb, insertGeneratedDoc } from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import { renderCompletionReport } from "../templates/completion-report";
import type { CompletionReportData } from "../templates/completion-report";

export const GenerateCompletionReportInput = z.object({
  entityId: z.string().uuid(),
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  data: z.record(z.unknown()),
});

export async function generateCompletionReport(
  session: AuthSession,
  input: z.infer<typeof GenerateCompletionReportInput>,
): Promise<{ docId: string; htmlContent: string }> {
  authorize(session, "generate_documents");
  const parsed = GenerateCompletionReportInput.parse(input);

  const html = renderCompletionReport(parsed.data as unknown as CompletionReportData);
  const storagePath = `generated/${parsed.entityId}/${parsed.caseId}/completion-report-${Date.now()}.html`;

  return getDb().transaction(async (tx) => {
    const doc = await insertGeneratedDoc(tx, {
      entityId: parsed.entityId,
      caseId: parsed.caseId,
      clientId: parsed.clientId,
      type: "completion_report",
      templateKey: "completion_report",
      storagePath,
      mimeType: "text/html",
      templateData: parsed.data as Record<string, unknown>,
      createdBy: session.userId,
      updatedBy: session.userId,
    });
    return { docId: doc.id, htmlContent: html };
  });
}
