import { Children, Fragment, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { Components } from "react-markdown";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import {
  LegalContact,
  LegalJurisdiction,
  LegalName,
  LegalUrl,
} from "../lib/legal-contact";
import { LegalSection } from "./legal-page";

const LEGAL_CONTACT_TOKEN = "{{contact}}";
const LEGAL_JURISDICTION_TOKEN = "{{jurisdiction}}";
const LEGAL_NAME_TOKEN = "{{name}}";
const LEGAL_URL_TOKEN = "{{url}}";

const linkClassName = "text-foreground underline underline-offset-4";

function injectLegalTokens(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") {
      return child;
    }

    if (
      !child.includes(LEGAL_CONTACT_TOKEN) &&
      !child.includes(LEGAL_JURISDICTION_TOKEN) &&
      !child.includes(LEGAL_NAME_TOKEN) &&
      !child.includes(LEGAL_URL_TOKEN)
    ) {
      return child;
    }

    return child
      .split(/(\{\{contact\}\}|\{\{jurisdiction\}\}|\{\{name\}\}|\{\{url\}\})/)
      .map((part, index) => {
        if (part === LEGAL_CONTACT_TOKEN) {
          return <LegalContact key={index} />;
        }

        if (part === LEGAL_JURISDICTION_TOKEN) {
          return <LegalJurisdiction key={index} />;
        }

        if (part === LEGAL_NAME_TOKEN) {
          return <LegalName key={index} />;
        }

        if (part === LEGAL_URL_TOKEN) {
          return <LegalUrl key={index} />;
        }

        return <Fragment key={index}>{part}</Fragment>;
      });
  });
}

function isInternalPath(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

const markdownComponents: Components = {
  p: ({ children }) => <p>{injectLegalTokens(children)}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{injectLegalTokens(children)}</strong>
  ),
  em: ({ children }) => <em className="italic">{injectLegalTokens(children)}</em>,
  a: ({ href, children }) => {
    if (href && isInternalPath(href)) {
      return (
        <Link to={href} className={linkClassName}>
          {injectLegalTokens(children)}
        </Link>
      );
    }

    return (
      <a href={href} className={linkClassName}>
        {injectLegalTokens(children)}
      </a>
    );
  },
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 ps-5">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 ps-5">{children}</ol>,
  li: ({ children }) => <li>{injectLegalTokens(children)}</li>,
  h3: ({ children }) => (
    <h3 className="font-heading text-base font-semibold tracking-tight text-foreground mt-4">
      {injectLegalTokens(children)}
    </h3>
  ),
  img: () => null,
};

function MarkdownBody({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      urlTransform={defaultUrlTransform}
    >
      {source}
    </ReactMarkdown>
  );
}

type LegalMarkdownSection = {
  title: string;
  body: string;
};

function splitLegalMarkdown(source: string): {
  intro: string;
  sections: LegalMarkdownSection[];
} {
  const normalized = source
    .replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const heading = /^##\s+/m;
  const first = normalized.search(heading);

  if (first === -1) {
    return { intro: normalized, sections: [] };
  }

  const intro = normalized.slice(0, first).trim();
  const chunks = normalized
    .slice(first)
    .split(/^##\s+/m)
    .filter((chunk) => chunk.trim().length > 0);

  const sections = chunks.map((chunk) => {
    const newline = chunk.indexOf("\n");
    if (newline === -1) {
      return { title: chunk.trim(), body: "" };
    }

    return {
      title: chunk.slice(0, newline).trim(),
      body: chunk.slice(newline + 1).trim(),
    };
  });

  return { intro, sections };
}

export function LegalMarkdown({ source }: { source: string }) {
  const { intro, sections } = splitLegalMarkdown(source);

  return (
    <div className="flex flex-col gap-8">
      {intro ? (
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <MarkdownBody source={intro} />
        </div>
      ) : null}
      {sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          {section.body ? <MarkdownBody source={section.body} /> : null}
        </LegalSection>
      ))}
    </div>
  );
}
