import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { isJumboEmojiMessage } from "@/lib/twemoji";
import {
  parseDiscordUserIdFromHref,
  preprocessMessageMarkdown,
} from "../utils/messages/markdown";
import { TwemojiText } from "./twemoji-text";
import { UserMentionLink } from "./user-mention-link";

function mapTextNodes(children: ReactNode, jumbo: boolean): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return <TwemojiText text={child} jumbo={jumbo} />;
    }

    if (typeof child === "number") {
      return child;
    }

    if (!isValidElement(child)) {
      return child;
    }

    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.props.children == null) {
      return element;
    }

    return cloneElement(element, {
      ...element.props,
      children: mapTextNodes(element.props.children, jumbo),
    });
  });
}

function createMarkdownComponents(jumbo: boolean): Components {
  const withEmoji = (children: ReactNode) => mapTextNodes(children, jumbo);

  return {
    h1: ({ children }) => (
      <h1 className="mt-2 mb-1 text-lg font-semibold text-foreground first:mt-0">
        {withEmoji(children)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-2 mb-1 text-base font-semibold text-foreground first:mt-0">
        {withEmoji(children)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-2 mb-1 text-sm font-semibold text-foreground first:mt-0">
        {withEmoji(children)}
      </h3>
    ),
    p: ({ children }) => (
      <p
        className={cn(
          "mb-2 last:mb-0",
          jumbo ? "leading-none" : "leading-relaxed",
        )}
      >
        {withEmoji(children)}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">
        {withEmoji(children)}
      </strong>
    ),
    em: ({ children }) => <em className="italic">{withEmoji(children)}</em>,
    a: ({ children, href }) => {
      const userId = parseDiscordUserIdFromHref(href);
      if (userId) {
        return (
          <UserMentionLink userId={userId}>
            {withEmoji(children)}
          </UserMentionLink>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
          onClick={(event) => event.stopPropagation()}
        >
          {withEmoji(children)}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="mb-2 list-disc space-y-1 ps-5 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal space-y-1 ps-5 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">{withEmoji(children)}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mb-2 border-s-2 border-border ps-3 text-muted-foreground last:mb-0">
        {children}
      </blockquote>
    ),
    // Keep code/pre literal — no Twemoji substitution inside code.
    code: ({ className, children }) => {
      const isBlock = Boolean(className);
      if (isBlock) {
        return (
          <code className="block overflow-x-auto rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
            {children}
          </code>
        );
      }

      return (
        <code className="inline rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mb-2 overflow-x-auto rounded-md border border-border bg-muted p-2 last:mb-0 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    ),
    img: ({ src, alt }) => {
      if (!src) return null;

      const isDiscordEmoji = src.includes("cdn.discordapp.com/emojis/");
      if (isDiscordEmoji) {
        return (
          <img
            src={src}
            alt={alt ?? "emoji"}
            draggable={false}
            loading="lazy"
            className={cn(
              "emoji inline-block object-contain",
              jumbo
                ? "mx-0.5 size-12 align-middle"
                : "mx-[0.05em] h-[1.375em] w-[1.375em] align-[-0.2em]",
            )}
          />
        );
      }

      return (
        <img
          src={src}
          alt={alt ?? ""}
          className="max-h-80 max-w-full rounded-md border border-border object-contain"
          loading="lazy"
        />
      );
    },
    hr: () => <hr className="my-3 border-border" />,
  };
}

type MessageMarkdownProps = {
  content: string;
  className?: string;
};

export function MessageMarkdown({ content, className }: MessageMarkdownProps) {
  const jumbo = isJumboEmojiMessage(content);

  return (
    <div
      className={cn(
        jumbo ? "text-base text-foreground" : "text-sm text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={createMarkdownComponents(jumbo)}
        urlTransform={defaultUrlTransform}
      >
        {preprocessMessageMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}
