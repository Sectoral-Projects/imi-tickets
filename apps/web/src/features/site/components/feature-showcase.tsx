import { cn } from "@/lib/utils";

type FeatureShowcaseProps = {
  title: string;
  description: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
};

export function FeatureShowcase({
  title,
  description,
  bullets,
  imageSrc,
  imageAlt,
  reverse = false,
}: FeatureShowcaseProps) {
  return (
    <section
      className={cn(
        "grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
        reverse && "lg:[&>*:first-child]:order-2",
      )}
    >
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        <ul className="flex flex-col gap-2.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full object-cover object-top"
          loading="lazy"
        />
      </div>
    </section>
  );
}
