import { FIRMS } from "../lib/firms";
import { buildForm648Doc, EMPTY_648_TAXES } from "../lib/form-648-pdf";
for (const slug of ["gns", "llp", "galaxy"]) {
  const firm = FIRMS[slug]!;
  const d = await buildForm648Doc({ firm, clientName: "", taxes: EMPTY_648_TAXES, keepEditable: true });
  const f = d.getForm();
  const g = (n: string) => { try { return f.getTextField(n).getText() ?? ""; } catch { return "<?>"; } };
  console.log("== " + firm.legalName);
  for (const n of ["AgentName","AgentsAddress1","AgentsAddress2","AgentsAddress3","AgentsPostCode","AgentsPhoneNumber","Agent code SA","Agent code CT","CIS Agent Gateway ID","CIS PAYE ID"])
    console.log("   " + n.padEnd(22) + JSON.stringify(g(n)));
}
