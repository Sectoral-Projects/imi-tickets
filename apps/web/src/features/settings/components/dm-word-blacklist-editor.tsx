import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { WordFilterRule } from "../schemas/settings";

export function wordFilterRulesEqual(
  a: WordFilterRule[] | undefined,
  b: WordFilterRule[] | undefined,
) {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every(
    (rule, index) =>
      rule.term === right[index]?.term && rule.match === right[index]?.match,
  );
}

export function DmWordBlacklistEditor({
  value,
  disabled,
  onChange,
}: {
  value: WordFilterRule[];
  disabled?: boolean;
  onChange: (value: WordFilterRule[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">DM word blacklist</Label>
        <p className="text-sm text-muted-foreground">
          Reject member DMs that contain these keywords or exact terms. Rejected
          messages are not logged or relayed to staff.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {value.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Input
              value={rule.term}
              disabled={disabled}
              placeholder="Term"
              className="min-w-40 flex-1"
              onChange={(event) => {
                const next = [...value];
                next[index] = { ...rule, term: event.target.value };
                onChange(next);
              }}
            />
            <Select
              value={rule.match}
              disabled={disabled}
              onValueChange={(match) => {
                if (match !== "keyword" && match !== "exact") return;
                const next = [...value];
                next[index] = { ...rule, match };
                onChange(next);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Keyword</SelectItem>
                <SelectItem value="exact">Exact</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      {!disabled && value.length < 100 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { term: "", match: "keyword" }])}
        >
          <Plus data-icon="inline-start" />
          Add term
        </Button>
      ) : null}
    </div>
  );
}
