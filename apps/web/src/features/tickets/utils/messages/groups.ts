const CHAIN_TIME_MS = 2 * 60 * 1000;

export function groupMessages<
  T extends {
    authorId: string;
    channelId: string;
    createdAt: Date | string;
  },
>(messages: readonly T[]): T[][] {
  const groups: T[][] = [];

  for (const message of messages) {
    const lastGroup = groups.at(-1);

    if (!lastGroup) {
      groups.push([message]);
      continue;
    }

    const previous = lastGroup[lastGroup.length - 1];

    const sameAuthor = previous.authorId === message.authorId;
    const sameChannel = previous.channelId === message.channelId;

    const withinWindow =
      new Date(message.createdAt).getTime() -
        new Date(previous.createdAt).getTime() <=
      CHAIN_TIME_MS;

    if (sameAuthor && sameChannel && withinWindow) {
      lastGroup.push(message);
    } else {
      groups.push([message]);
    }
  }

  return groups;
}
