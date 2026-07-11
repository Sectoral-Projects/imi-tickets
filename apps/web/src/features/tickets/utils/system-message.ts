export const TRANSCRIPT_SYSTEM_AUTHOR_ID = "transcript:system";

export function isSystemTranscriptMessage(authorId: string) {
  return authorId === TRANSCRIPT_SYSTEM_AUTHOR_ID;
}
