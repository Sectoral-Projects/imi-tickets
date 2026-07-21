import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  deleteTemplate,
  fetchChannelOpenButtons,
  fetchDmOpenButtons,
  fetchTemplates,
  replaceChannelOpenButtons,
  replaceDmOpenButtons,
  updateTemplate,
} from "../api/templates";
import type { ChannelOpenButtonDraft, DmOpenButtonDraft } from "../schemas/templates";

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: ["templates"] as const,
    queryFn: fetchTemplates,
    enabled,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateTemplate>[1] }) =>
      updateTemplate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDmOpenButtons(enabled = true) {
  return useQuery({
    queryKey: ["dm-open-buttons"] as const,
    queryFn: fetchDmOpenButtons,
    enabled,
  });
}

export function useReplaceDmOpenButtons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (buttons: DmOpenButtonDraft[]) => replaceDmOpenButtons(buttons),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dm-open-buttons"] }),
  });
}

export function useChannelOpenButtons(enabled = true) {
  return useQuery({
    queryKey: ["channel-open-buttons"] as const,
    queryFn: fetchChannelOpenButtons,
    enabled,
  });
}

export function useReplaceChannelOpenButtons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (buttons: ChannelOpenButtonDraft[]) => replaceChannelOpenButtons(buttons),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channel-open-buttons"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
