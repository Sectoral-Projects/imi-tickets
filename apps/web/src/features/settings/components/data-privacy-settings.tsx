import { useState } from "react";
import { AlertTriangle, Download, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  downloadGdprExport,
  executeDataDeletion,
  previewDataDeletion,
  processGdprUser,
} from "../api/privacy";
import {
  DATA_CATEGORY_LABELS,
  DANGEROUS_DELETE_CONFIRMATION,
  GDPR_ANONYMIZE_CONFIRMATION,
  GDPR_ERASE_CONFIRMATION,
  type DataCategory,
  type DataDeletionPreview,
} from "../schemas/privacy";

const DATA_CATEGORIES = Object.keys(DATA_CATEGORY_LABELS) as DataCategory[];

export function DataPrivacySettingsSection({ disabled = false }: { disabled?: boolean }) {
  const [selectedCategories, setSelectedCategories] = useState<DataCategory[]>([]);
  const [deletePreview, setDeletePreview] = useState<DataDeletionPreview | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [gdprUserId, setGdprUserId] = useState("");
  const [gdprError, setGdprError] = useState<string | null>(null);
  const [gdprBusy, setGdprBusy] = useState<"export" | "anonymize" | "erase" | null>(null);
  const [anonymizeConfirmation, setAnonymizeConfirmation] = useState("");
  const [eraseConfirmation, setEraseConfirmation] = useState("");

  function toggleCategory(category: DataCategory, checked: boolean) {
    setSelectedCategories((current) => {
      if (checked) return [...new Set([...current, category])];
      return current.filter((entry) => entry !== category);
    });
    setDeletePreview(null);
  }

  async function handlePreviewDelete() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const preview = await previewDataDeletion(selectedCategories);
      setDeletePreview(preview);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to preview deletion");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleExecuteDelete() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const result = await executeDataDeletion(selectedCategories, deleteConfirmation);
      setDeletePreview(result);
      setDeleteConfirmation("");
      setSelectedCategories([]);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete data");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleExport() {
    setGdprError(null);
    setGdprBusy("export");
    try {
      await downloadGdprExport(gdprUserId.trim());
    } catch (error) {
      setGdprError(error instanceof Error ? error.message : "Failed to export GDPR data");
    } finally {
      setGdprBusy(null);
    }
  }

  async function handleAnonymize() {
    setGdprError(null);
    setGdprBusy("anonymize");
    try {
      await processGdprUser(gdprUserId.trim(), "anonymize", anonymizeConfirmation);
      setAnonymizeConfirmation("");
    } catch (error) {
      setGdprError(error instanceof Error ? error.message : "Failed to anonymize user data");
    } finally {
      setGdprBusy(null);
    }
  }

  async function handleErase() {
    setGdprError(null);
    setGdprBusy("erase");
    try {
      await processGdprUser(gdprUserId.trim(), "erase", eraseConfirmation);
      setEraseConfirmation("");
    } catch (error) {
      setGdprError(error instanceof Error ? error.message : "Failed to erase user data");
    } finally {
      setGdprBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Dangerous data deletion
          </CardTitle>
          <CardDescription>
            Permanently delete selected data categories from this instance. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {DATA_CATEGORIES.map((category) => (
              <label key={category} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  disabled={disabled || deleteBusy}
                  onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                />
                <span className="text-sm leading-relaxed">{DATA_CATEGORY_LABELS[category]}</span>
              </label>
            ))}
          </div>

          {deletePreview ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Preview</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {Object.entries(deletePreview.counts).map(([category, count]) =>
                  count > 0 ? (
                    <li key={category}>
                      {DATA_CATEGORY_LABELS[category as DataCategory]}: {count}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || deleteBusy || selectedCategories.length === 0}
              onClick={handlePreviewDelete}
            >
              Preview deletion
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Type {DANGEROUS_DELETE_CONFIRMATION} to confirm</Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              disabled={disabled || deleteBusy}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={DANGEROUS_DELETE_CONFIRMATION}
            />
          </div>

          <Button
            type="button"
            variant="destructive"
            disabled={
              disabled ||
              deleteBusy ||
              selectedCategories.length === 0 ||
              deleteConfirmation.trim() !== DANGEROUS_DELETE_CONFIRMATION
            }
            onClick={handleExecuteDelete}
          >
            Delete selected data
          </Button>

          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4" />
            GDPR subject requests
          </CardTitle>
          <CardDescription>
            Export or process erasure for a Discord user. Anonymization assigns one new random ID
            across all of their records so tickets still render as a single person without any link
            to the original account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gdpr-user-id">Discord user ID</Label>
            <Input
              id="gdpr-user-id"
              value={gdprUserId}
              disabled={disabled || gdprBusy !== null}
              onChange={(event) => setGdprUserId(event.target.value)}
              placeholder="123456789012345678"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || gdprBusy !== null || !/^\d{17,20}$/.test(gdprUserId.trim())}
              onClick={handleExport}
            >
              <Download className="size-4" />
              Download GDPR export
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="anonymize-confirmation">
              Anonymize — type {GDPR_ANONYMIZE_CONFIRMATION}
            </Label>
            <Input
              id="anonymize-confirmation"
              value={anonymizeConfirmation}
              disabled={disabled || gdprBusy !== null}
              onChange={(event) => setAnonymizeConfirmation(event.target.value)}
              placeholder={GDPR_ANONYMIZE_CONFIRMATION}
            />
            <Button
              type="button"
              disabled={
                disabled ||
                gdprBusy !== null ||
                !/^\d{17,20}$/.test(gdprUserId.trim()) ||
                anonymizeConfirmation.trim() !== GDPR_ANONYMIZE_CONFIRMATION
              }
              onClick={handleAnonymize}
            >
              Anonymize user data
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="erase-confirmation">Full erasure — type {GDPR_ERASE_CONFIRMATION}</Label>
            <Input
              id="erase-confirmation"
              value={eraseConfirmation}
              disabled={disabled || gdprBusy !== null}
              onChange={(event) => setEraseConfirmation(event.target.value)}
              placeholder={GDPR_ERASE_CONFIRMATION}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={
                disabled ||
                gdprBusy !== null ||
                !/^\d{17,20}$/.test(gdprUserId.trim()) ||
                eraseConfirmation.trim() !== GDPR_ERASE_CONFIRMATION
              }
              onClick={handleErase}
            >
              Erase user data
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Anonymization scrubs identity snapshots and removes references to the user across the
            entire ticket, including staff messages. Full erasure deletes owned tickets and the
            user&apos;s messages where possible. Discord messages already sent in channels are not
            removed by this tool.
          </p>

          {gdprError ? <p className="text-sm text-destructive">{gdprError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
