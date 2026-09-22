import termsMarkdown from "../content/terms.md?raw";
import { LegalMarkdown } from "./legal-markdown";
import { LegalPage } from "./legal-page";

export function TermsContent() {
  return (
    <LegalPage title="Terms of service" otherHref="/privacy" otherLabel="privacy policy">
      <LegalMarkdown source={termsMarkdown} />
    </LegalPage>
  );
}
