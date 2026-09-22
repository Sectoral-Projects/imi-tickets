import type { ReactNode } from "react";
import { Link } from "react-router";

export function LegalPage({
  title,
  otherHref,
  otherLabel,
  children,
}: {
  title: string;
  otherHref: string;
  otherLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">Last updated September 11, 2026</p>
        </header>

        <div className="flex flex-col gap-8">{children}</div>

        <p className="text-sm text-muted-foreground">
          See also the{" "}
          <Link
            to={otherHref}
            className="text-foreground underline underline-offset-4"
          >
            {otherLabel}
          </Link>
          .
        </p>
      </article>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}
