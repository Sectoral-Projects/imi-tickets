import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTemplate } from "../hooks/templates";
import { MODAL_TEMPLATE_CATEGORY } from "../constants";
import { createDefaultBuilderState, buildTemplateFromBuilder } from "../utils/component-v2";
import {
  buildModalTemplateFromBuilder,
  createDefaultModalBuilderState,
} from "../utils/modal-v2";

type NewTemplateType = "message" | "modal";

export function CreateTemplateDialog({
  canManage,
  onCreated,
}: {
  canManage: boolean;
  onCreated: (templateId: string) => void;
}) {
  const createTemplate = useCreateTemplate();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState<NewTemplateType>("message");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setId("");
    setName("");
    setTemplateType("message");
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const isModal = templateType === "modal";
      const created = await createTemplate.mutateAsync({
        id,
        name,
        category: isModal ? MODAL_TEMPLATE_CATEGORY : "custom",
        enabled: true,
        template: isModal
          ? buildModalTemplateFromBuilder(createDefaultModalBuilderState(name))
          : buildTemplateFromBuilder(createDefaultBuilderState(name)),
      });
      onCreated(created.id);
      setOpen(false);
      reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Failed to create template.");
    }
  };

  if (!canManage) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>New template</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create custom template</DialogTitle>
          <DialogDescription>
            Choose a template type, stable ID, and display name. You can build the
            content after creation.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Template type</Label>
            <Select
              value={templateType}
              onValueChange={(value) => setTemplateType(value as NewTemplateType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Component message</SelectItem>
                <SelectItem value="modal">Modal form</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-template-id">Template ID</Label>
            <Input
              id="new-template-id"
              value={id}
              placeholder={templateType === "modal" ? "bug-form" : "bug-info"}
              onChange={(event) => setId(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-template-name">Display name</Label>
            <Input
              id="new-template-name"
              value={name}
              placeholder={templateType === "modal" ? "Bug report form" : "Bug report info"}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!id.trim() || !name.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending ? "Creating…" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
