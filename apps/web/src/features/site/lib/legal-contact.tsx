import {
  getLegalContact,
  getLegalJurisdiction,
  getLegalName,
  getLegalUrl,
  isEmail,
  isHttpUrl,
} from "./legal-env";

export function LegalContact() {
  const value = getLegalContact();
  const className = "break-all text-foreground underline underline-offset-4";

  if (isHttpUrl(value)) {
    return (
      <a href={value} className={className}>
        {value}
      </a>
    );
  }

  if (isEmail(value)) {
    return (
      <a href={`mailto:${value}`} className={className}>
        {value}
      </a>
    );
  }

  return <span className="break-all">{value}</span>;
}

export function LegalName() {
  return <span className="text-foreground">{getLegalName()}</span>;
}

export function LegalUrl() {
  const value = getLegalUrl();

  if (isHttpUrl(value)) {
    return (
      <a href={value} className="break-all text-foreground underline underline-offset-4">
        {value}
      </a>
    );
  }

  return <span className="break-all">{value}</span>;
}

export function LegalJurisdiction() {
  return <span className="text-foreground">{getLegalJurisdiction()}</span>;
}
