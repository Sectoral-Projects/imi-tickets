export type Attachment = {
  id: number;
  messageId: number | null;
  noteId: number | null;
  url: string;
  name: string | null;
  isSpoiler: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type MessageMemberSnapshot = {
  id: number;
  userId: string;
  username: string | null;
  globalName: string | null;
  avatar: string | null;
  roleIds: string[] | null;
  highestRoleId: string | null;
  nickname: string | null;
  capturedAt: string;
};

export type MessageReaction = {
  emoji: {
    name: string;
    id: string | null;
    animated: boolean;
  };
  count: number;
  userIds: string[];
};

export type MessageReplyPreview = {
  id: number;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  content: string;
  deletedAt: string | null;
};

export type MessageRevision = {
  revision: number;
  content: string;
  editedAt: string;
};

export type Message = {
  id: number;
  threadId: number;
  channelId: string;
  authorId: string;
  messageId: string;
  memberSnapshotId: number | null;
  content: string;
  isForwarded: boolean;
  isPrivateStaff: boolean;
  replyToMessageId: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type EnrichedMessage = Message & {
  author: MessageMemberSnapshot | null;
  attachments: Attachment[];
  editHistory: MessageRevision[];
  reactions: MessageReaction[];
  replyTo: MessageReplyPreview | null;
};