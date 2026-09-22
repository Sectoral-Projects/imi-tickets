import privacyMarkdown from "../content/privacy.md?raw";
import { LegalMarkdown } from "./legal-markdown";
import { LegalPage } from "./legal-page";

export function PrivacyContent() {
  return (
    <LegalPage title="Privacy policy" otherHref="/terms" otherLabel="terms of service">
      <LegalMarkdown source={privacyMarkdown} />
    </LegalPage>
  );
}
