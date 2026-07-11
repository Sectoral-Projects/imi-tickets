import { z } from "zod";

export const dataCategorySchema = z.enum([
  "tickets",
  "member_snapshots",
  "audit_log",
  "blocked_entities",
  "pending_ticket_opens",
]);

export type DataCategory = z.infer<typeof dataCategorySchema>;

export const dataDeletionPreviewSchema = z.object({
  categories: z.array(dataCategorySchema),
  counts: z.record(dataCategorySchema, z.number()),
});

export type DataDeletionPreview = z.infer<typeof dataDeletionPreviewSchema>;

export const gdprEraseModeSchema = z.enum(["anonymize", "erase"]);

export type GdprEraseMode = z.infer<typeof gdprEraseModeSchema>;

export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  tickets:
    "Tickets and conversations (threads, messages, notes, attachments, participants, tags, status history)",
  member_snapshots: "Member identity snapshots",
  audit_log: "Audit log",
  blocked_entities: "Blocked users and roles",
  pending_ticket_opens: "Pending ticket open requests",
};

export const DANGEROUS_DELETE_CONFIRMATION = "DELETE DATA";
export const GDPR_ANONYMIZE_CONFIRMATION = "ANONYMIZE USER";
export const GDPR_ERASE_CONFIRMATION = "ERASE USER";
