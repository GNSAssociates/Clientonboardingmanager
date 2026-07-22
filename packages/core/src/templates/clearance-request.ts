export const CLEARANCE_REQUEST_TEMPLATE = `
<div class="letter-body">
  <p>{{entity.address}}</p>
  <p>{{date}}</p>

  <p>
    {{prevFirm.name}}<br>
    {{#if prevFirm.address}}{{prevFirm.address}}<br>{{/if}}
    {{#if prevFirm.email}}{{prevFirm.email}}{{/if}}
  </p>

  <p>Dear Sir / Madam,</p>

  <p>
    <strong>Re: {{client.name}}{{#if client.companyNumber}} (Company No. {{client.companyNumber}}){{/if}}</strong><br>
    <strong>Request for Professional Clearance</strong>
  </p>

  <p>
    We write to inform you that the above-named client has approached {{entity.legalName}} with
    a view to appointing us as their professional advisers. We would be grateful if you would
    confirm, in accordance with the ICAEW Code of Ethics (and ACCA/CIOT where applicable),
    whether you are aware of any professional reason why we should not accept this appointment.
  </p>

  <p>
    In particular, please confirm:
  </p>

  <ol>
    <li>Whether there are any outstanding fees or disbursements owed to your firm;</li>
    <li>Whether there are any matters that, in your professional judgement, we should be aware of;</li>
    <li>Whether you are aware of any circumstances that might cast doubt on the client's
        integrity or honesty; and</li>
    <li>Whether you hold any books, records, or documents belonging to the client that
        you would be prepared to release to us on receipt of appropriate authority.</li>
  </ol>

  <p>
    We attach a copy of the client's written authority for you to communicate with us. We would
    be grateful for your response within <strong>{{responseDeadlineDays}} days</strong> of the
    date of this letter. If we do not hear from you within that period, we shall assume that
    there are no professional reasons preventing us from accepting the appointment.
  </p>

  <p>
    We look forward to receiving your reply and thank you for your co-operation.
  </p>

  <p>Yours faithfully,</p>

  <div class="signature-block">
    <p>{{entity.signatoryName}}<br>
    {{entity.legalName}}</p>
  </div>

  <hr />
  <p class="footer-small">
    {{entity.legalName}} is registered with {{entity.amlSupervisor}}.
    {{entity.registrationDetails}}
  </p>
</div>
`.trim();
