/**
 * Per-service Schedule of Services library.
 *
 * Instead of one fixed block of wording, the engagement letter now assembles
 * its Schedule of Services from these entries — only the schedules for the
 * services actually selected are included, exactly like the firm's ICAEW/ACCA
 * letter templates ("This section provides full explanation of the services
 * you have engaged us to carry out").
 *
 * Each schedule sets out the client's and the firm's responsibilities in
 * ACCA/ICAEW engagement-letter style. Keyed by the service ids used on the
 * services page.
 */

export interface ServiceSchedule {
  id: string;
  title: string;
  /** HTML body — uses the letter engine's h3/p/ul styling */
  html: (ctx: { firmName: string; regBody: string }) => string;
}

const p = (s: string) => `<p>${s}</p>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const yourRes = `<h3>Your responsibilities</h3>`;
const ourRes = `<h3>Our responsibilities</h3>`;

export const SERVICE_SCHEDULES: ServiceSchedule[] = [
  {
    id: 'annual_accounts',
    title: 'Preparation of Statutory Financial Statements and Corporation Tax',
    html: ({ regBody }) =>
      yourRes +
      p(`As directors of the company, you are responsible for preparing financial statements which give a true and fair view and which have been prepared in accordance with the Companies Act 2006. You must not approve the financial statements unless you are satisfied that they give a true and fair view of the assets, liabilities, financial position and profit or loss of the company. In preparing the financial statements you are required to:`) +
      ul([
        'select suitable accounting policies and then apply them consistently;',
        'make judgements and estimates that are reasonable and prudent;',
        'state whether applicable UK Accounting Standards have been followed, subject to any material departures disclosed and explained in the financial statements; and',
        'prepare the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.',
      ]) +
      p(`You are responsible for keeping adequate accounting records that set out with reasonable accuracy at any time the company's financial position, for safeguarding the assets of the company, for taking reasonable steps to prevent and detect fraud and other irregularities, and for determining whether, in each financial year, the company meets the conditions for exemption from an audit as set out in section 477 or 480 of the Companies Act 2006. You have undertaken to make available to us, as and when required, all the company's accounting records and related financial information, including minutes of management and members' meetings, that we need to do our work.`) +
      p(`You are also responsible for ensuring the company complies with the laws and regulations that apply to its activities, for the completeness and accuracy of the corporation tax return, and for making payment of corporation tax by the due date. Where corporation tax quarterly instalment payments are required for large companies, you are responsible for making those payments on time.`) +
      p(`It is your responsibility to retain and provide us with all records and information relevant to the preparation of your accounts. You must provide us with all the records within a reasonable timeframe after your accounting year end. If records are provided late or are incomplete, we accept no responsibility for any penalties arising from late filing.`) +
      ourRes +
      p(`We will prepare the annual financial statements in accordance with FRS 102 (or FRS 105 for micro-entities where applicable) from the books, accounting records and other information and explanations provided to us. We shall plan our work on the basis that no report on the financial statements is required by statute or regulation for the year. Our work will not be an audit of the financial statements in accordance with International Standards on Auditing (UK), so we will not be able to provide any assurance that the accounting records or the financial statements are free from material misstatement, whether caused by fraud, other irregularities or error, nor to identify weaknesses in internal controls.`) +
      p(`We will not be carrying out any audit work as part of this assignment and accordingly will not verify the assets and liabilities of the business, nor the items of expenditure and income. We shall not seek any independent evidence to support the entries in the accounting records, or to prove the existence, ownership or valuation of assets or completeness of income, liabilities or disclosure in the accounts. Nor shall we assess the reasonableness of any estimates or judgements made in the preparation of the accounts. Consequently, our work will not provide any assurance that the accounting records are free from material misstatement, irregularities or error.`) +
      p(`We will advise you on whether your records are adequate for the preparation of the financial statements and recommend improvements. We will prepare the corporation tax computation and CT600 return from the financial statements and the information and explanations you provide, calculate the company's corporation tax liability (including any research and development relief claims where instructed), advise you of amounts and due dates for payment, and, following your approval, submit the return with iXBRL-tagged accounts to HMRC and file the accounts with Companies House within the statutory deadlines, provided we receive your complete records and approvals in good time.`) +
      p(`We have a professional duty to compile financial statements that conform with generally accepted accounting principles and a professional responsibility not to allow our name to be associated with financial statements which we believe may be misleading. In extreme cases, where this matter cannot be resolved, we will withdraw from the engagement and notify you in writing of the reasons.`) +
      p(`To ensure that anyone reading the accounts is aware that we have not carried out an audit, we will attach to the accounts a report developed by the Consultative Committee of Accountancy Bodies (CCAB) that explains what work has been done by us, the professional requirements we have fulfilled and the standard to which the work has been carried out. Web links are provided in the report so that you can obtain further information from ${regBody} about the technical guidance for the work, and the related ethical and other professional requirements.`) +
      p(`Once we have issued our report, we have no further responsibility in relation to the accounts for that financial year.`),
  },
  {
    id: 'bookkeeping_vat',
    title: 'Bookkeeping and VAT Returns (Making Tax Digital)',
    html: () =>
      `<h3>MTD for VAT — Initial Setup</h3>` +
      p(`We will register you for Making Tax Digital for VAT (MTDfV) if you are not already registered. By instructing us to sign up on your behalf you are agreeing to HMRC's terms of participation. You will need to complete HMRC's sign-up process to enable submission of your returns. We will maintain digital records that meet the MTD requirements using functional compatible software with appropriate digital links between software programs.`) +
      yourRes +
      p(`You are responsible for retaining and providing us with all source documents and records relevant to the business — including sales invoices, purchase invoices and receipts, bank and credit card statements, loan agreements and details of cash transactions — promptly and, in any event, within 14 days of the end of each VAT period.`) +
      p(`You remain legally responsible for:`) +
      ul([
        'the accuracy and completeness of each VAT return and ensuring that all digital links are in the manner prescribed;',
        'paying the VAT due by the due date;',
        'telling us about all supplies made and received, any special schemes, partial exemption, imports/exports and anything unusual affecting the period;',
        'ensuring that information provided is, to the best of your knowledge, accurate and complete — we accept no responsibility for any liabilities arising due to inaccuracies, omissions or breakdowns in digital links;',
        'monitoring your monthly turnover to establish whether you are liable to register for VAT (if you have any other business not registered for VAT) and notifying us in good time to submit the registration within one month of exceeding the threshold; and',
        'informing us that you have made the tax payment based on your calculated return.',
      ]) +
      p(`You will keep us informed of material changes in circumstances that could affect your VAT obligations, for example:`) +
      ul([
        'change in the nature of your business or type of supply for VAT;',
        'change in turnover or type of business entity;',
        'acquisition or disposal of land or property;',
        'starting to make supplies that are exempt from VAT;',
        'transactions within Northern Ireland requiring an XI EORI number;',
        'you have reclaimed VAT within the last 10 years on purchasing, building or redeveloping a property over £250,000, and its use has changed (Capital Goods Scheme adjustments may apply).',
      ]) +
      p(`You are responsible for bringing to our attention any errors, omissions or inaccuracies in your returns that you become aware of after submission so that we may assist you to make a voluntary disclosure. If you provide digital services or make distance sales of goods to private consumers in the European Union, you are responsible for either registering for VAT in that member state or registering for the VAT One Stop Shop (OSS/IOSS).`) +
      ourRes +
      p(`We will write up the books and records of the business from the documents and information you provide, using MTD-compatible software with appropriate digital links, and will reconcile the bank accounts for each period. We will prepare the VAT returns from those records, advise you of the VAT payable or repayable and the due date, and, once you have approved each return, submit it electronically to HMRC under MTD for VAT.`) +
      p(`Where you wish us to deal with HMRC communications, you will forward to us all communications received from HMRC such as statements of account, copies of notices of assessment and letters. These must be provided in time to enable us to deal with them within the statutory time limits. It is essential that you let us have copies of any correspondence received because HMRC is not obliged to send us copies of all communications issued to you.`) +
      p(`We will not audit or otherwise verify the records provided. The timeliness of each filing depends on receiving complete records and your approval in good time before the statutory deadline. We would ordinarily need a minimum of 14 days before submission to complete our work. If the records are provided later or are incomplete or unclear, we accept no responsibility for any penalty that may arise. If the volume of transactions materially exceeds the coverage threshold shown in this contract, additional fees apply as set out in the fee structure.`),
  },
  {
    id: 'paye',
    title: 'Payroll Services and Auto-Enrolment Pensions',
    html: () =>
      yourRes +
      p(`You are responsible for notifying us, by the agreed cut-off date for each pay period, of all information needed to run the payroll — including new starters and their details (including right-to-work status), leavers, changes to pay or hours, benefits, statutory payments (sickness, maternity, paternity, shared parental), attachment orders (DEAs, child maintenance), student loan deductions and any bonus or commission.`) +
      p(`You remain legally responsible as the employer for:`) +
      ul([
        'the accuracy and completeness of information supplied to us;',
        'ensuring compliance with employment law, National Minimum Wage/Living Wage, Working Time Regulations and right-to-work checks;',
        'paying employees their net pay on the agreed pay date;',
        'paying HMRC (PAYE/NIC) by the 22nd of the following month (or 19th by cheque);',
        'paying the pension provider by the due date;',
        'retaining payroll records for a minimum of three years after the end of the tax year to which they relate;',
        'the assessment of the tax status of your workers (employment vs self-employment) including off-payroll working (IR35) where applicable; and',
        "determining whether HMRC's optional remuneration arrangements rules apply to benefits provided.",
      ]) +
      p(`You must notify us promptly of any employee benefit in kind or expense payments so that we can determine whether they are reportable and/or payrollable. You are responsible for ensuring that all information supplied to us for the operation of PAYE is correct.`) +
      `<h3>Data processing</h3>` +
      p(`For the purposes of payroll services, we act as a data processor on your behalf (you remain the data controller). We will process employee personal data only on your documented instructions, keep it confidential, implement appropriate technical and organisational security measures, and assist you in responding to data subject access requests. On termination we will, at your direction, return or delete employee data unless we are required by law or regulation to retain it.`) +
      ourRes +
      p(`We will process the payroll for each pay period from the information you provide; produce payslips for each employee; calculate PAYE, National Insurance, student loan and pension deductions; submit Real Time Information (RTI) Full Payment Submissions (FPS) to HMRC on or before each pay day; submit Employer Payment Summaries (EPS) where required; advise you of amounts payable to HMRC and due dates; deal with starters and leavers (including forms P45); and prepare forms P60 for employees at the year end.`) +
      `<h3>Benefits in kind — P11D and Class 1A NIC</h3>` +
      p(`Where instructed, we will prepare forms P11D and P11D(b) from information provided by you detailing benefits in kind and expenses provided to directors and employees. We will calculate the Class 1A National Insurance contributions due and advise you of the payment date. You remain responsible for providing full and accurate details of all benefits, and for paying the Class 1A NIC by the due date (22 July following the tax year, or 19 July by cheque).`) +
      `<h3>Auto-enrolment pensions</h3>` +
      p(`We will assess employees for auto-enrolment at each pay reference period, issue appropriate communications to employees (enrolment, postponement, opt-in), process pension contributions, submit contribution schedules to your workplace pension provider, and prepare the re-enrolment assessment and re-declaration of compliance to The Pensions Regulator when due. You remain responsible for ensuring that the chosen pension scheme meets the statutory requirements and for paying contributions by the scheme's due dates.`) +
      p(`Fees for staff beyond the coverage threshold in this contract are charged as set out in the fee structure.`),
  },
  {
    id: 'cis',
    title: 'Construction Industry Scheme (CIS)',
    html: () =>
      yourRes +
      p(`You are responsible for:`) +
      ul([
        'determining whether workers are employees or subcontractors (the employment status of workers remains your legal responsibility);',
        'providing us with the details of all subcontractors engaged and gross amounts paid (including materials) by the 5th of each month;',
        'ensuring that you hold a valid registration as a contractor with HMRC before engaging subcontractors;',
        'paying the CIS deductions to HMRC by the 22nd of each month (or 19th by cheque); and',
        'retaining all records relating to CIS for at least three years after the end of the tax year to which they relate.',
      ]) +
      p(`You remain responsible for the operation of the scheme and any penalties arising from late or incorrect information supplied to us. If records are provided late or are incomplete, we accept no responsibility for any penalty that may arise from late filing.`) +
      ourRes +
      p(`We will verify subcontractors with HMRC to establish the correct deduction rate, prepare the monthly CIS300 contractor return from the information you provide, submit it to HMRC by the 19th of each month following your approval, advise you of the deductions payable, and provide payment and deduction statements for each subcontractor.`) +
      p(`Where relevant we will also reclaim or offset CIS deductions suffered by the company through the payroll EPS. At the year end, we will prepare and submit the annual CIS return where required.`) +
      p(`Where you wish us to deal with HMRC communications regarding CIS, you must forward all correspondence in time for us to deal with it within statutory time limits.`),
  },
  {
    id: 'self_assessment',
    title: "Directors' Personal Self-Assessment Tax Returns",
    html: () =>
      yourRes +
      p(`You are legally responsible for your own personal tax return. You agree:`) +
      ul([
        'that all returns are to be made on the basis of full disclosure of all sources of income, chargeable gains, charges, allowances and capital transactions;',
        'to provide all information necessary for dealing with your affairs promptly and, in any event, in good time before the 31 January filing deadline (we will need all relevant information by 30 November to guarantee filing by this date);',
        'to provide full details of all UK residential property disposals (including associated costs and valuations) prior to disposal — where you consider you will be non-UK resident, all UK property disposals must be advised prior to exchange of contracts;',
        'to authorise us to approach such third parties as may be appropriate for information we consider necessary;',
        'to keep us informed of material changes in your circumstances that could affect your tax liability; and',
        'to forward to us all communications received from HMRC (statements, notices of assessment, tax codes, letters) in time to enable us to deal with them within statutory time limits.',
      ]) +
      p(`You are legally responsible for ensuring that your tax return is correct and complete, for filing it by the due date, and for paying tax on time. Failure to do so may lead to penalties and/or interest. Taxpayers who approve returns cannot delegate this legal responsibility; you agree to check that returns prepared for you are complete before approving them.`) +
      p(`Note that HMRC no longer sends copies of notices of coding to agents. We will review PAYE notices of coding provided to us by you and advise accordingly.`) +
      `<h3>Making Tax Digital for Income Tax (MTD for IT)</h3>` +
      p(`If you are within the scope of Making Tax Digital for Income Tax, you are responsible for signing up with HMRC. If you wish us to assist, you should notify us in good time before the first quarterly return is due. By signing up you are agreeing to HMRC's terms of participation, which include deadlines and associated penalties. Where we prepare quarterly updates, we will require your records within 14 days after the quarter end. We will submit quarterly updates online to HMRC on the basis of the data provided by you. We are not responsible for considering or applying for any exemptions from MTD for IT; however, if you feel you are eligible, please let us know.`) +
      p(`Where a quarterly or annual submission obligation is missed, this may incur a penalty point according to HMRC's points-based system for late filing. Once the points threshold has been reached, a financial penalty may apply.`) +
      ourRes +
      p(`We will prepare your self-assessment tax return and supporting schedules from the information and explanations you provide, calculate your income tax, National Insurance contributions and capital gains tax liabilities, advise you of amounts and due dates for payment (including payments on account and any claims to reduce them), and, once you have approved the return, submit it electronically to HMRC.`) +
      p(`We will check PAYE codes and HMRC statements of account where copies are provided to us and deal with routine correspondence from HMRC concerning the return. Other than Universal Credit, we will advise you as to possible tax return-related claims and elections arising from information supplied by you.`) +
      `<h3>Ad hoc and advisory work</h3>` +
      p(`Where you instruct us to do so, we will provide such other taxation services as may be agreed. These are subject to the terms of this engagement letter and may incur additional fees. Examples include:`) +
      ul([
        'advising on the in-year Capital Gains Tax (CGT) reporting requirements on disposals of UK residential property, and preparing the in-year return and calculating the CGT due within 60 days of completion (we will require information as early as possible in advance of exchange of contracts);',
        'advising on ad hoc transactions and queries, preparing and submitting information to HMRC, and calculating any related tax liabilities;',
        'advising on double tax relief if appropriate;',
        'dealing with any compliance check or enquiry opened into your tax return by HMRC;',
        'preparing any amended returns that may be required and corresponding with HMRC as necessary; and',
        'advising on the rules relating to VAT registration and deregistration.',
      ]) +
      p(`We will not audit or verify the information you provide. Buy-to-let and rental property returns, and returns for additional individuals, are charged separately as set out in the Schedule of Service Charges (Annex A).`) +
      `<h3>Universal Credit</h3>` +
      p(`If we agree to advise you on Universal Credit, we will issue a separate letter or schedule to cover this area. Universal Credit is a social security benefit; your entitlement depends not only on your own circumstances but also those of your household.`) +
      `<h3>Employment taxes and pensions</h3>` +
      p(`You are responsible for employment taxes, pensions (including auto-enrolment) and the assessment of the tax status of your workers. If you do not understand what you need to consider or action you need to take, please ask us. We will not be in a position to assist you in complying with your responsibilities if we are not engaged to provide such a service. We are not responsible for any penalty that is incurred in relation to employment taxes where we are not engaged to provide that service.`),
  },
  {
    id: 'confirmation_statement',
    title: 'Company Secretarial — Confirmation Statement',
    html: () =>
      yourRes +
      p(`The directors remain legally responsible for the company’s statutory registers and filings. You are responsible for:`) +
      ul([
        "notifying us promptly of any changes to the company's registered details — including officers, registered office, share capital, shareholders and persons with significant control (PSC);",
        'confirming the accuracy of the information before filing;',
        "maintaining the company's statutory registers (register of members, register of directors, register of PSC, etc.) or instructing us to maintain them on your behalf;",
        "ensuring that the company's registered office address is appropriate and that all statutory mail is received and dealt with; and",
        'ensuring compliance with the Economic Crime and Corporate Transparency Act 2023 identity verification requirements.',
      ]) +
      ourRes +
      p(`We will prepare the annual confirmation statement (CS01) from the information held at Companies House and the changes you notify to us, send it to you for confirmation, and file it with Companies House by the due date once approved, paying the Companies House filing fee on your behalf (recharged as shown in this contract). One confirmation statement filing per year is included; additional filings are charged as set out in Annex A.`) +
      p(`Where instructed, we will also file notification of changes to officers, registered office, share capital and PSC details with Companies House. Such additional filings are charged as set out in Annex A unless otherwise agreed.`),
  },
  {
    id: 'registered_office',
    title: 'Registered Office Address Service',
    html: ({ firmName }) =>
      p(`We will provide our office address for use as the company's registered office and (where agreed) the directors' service address. We will receive statutory mail addressed to the company from Companies House, HMRC and other government bodies, and scan and forward it to you promptly. This service does not include general business or trading mail. You must not use the address as your trading address without our written agreement, and the service (and your right to use the address) ends automatically when this engagement ends, at which point you must file a change of registered office within 14 days. ${firmName} reserves the right to withdraw the service where required by our anti-money laundering obligations.`),
  },
  {
    id: 'quickbooks_subscription',
    title: 'Cloud Accounting Software Subscription (QuickBooks)',
    html: () =>
      p(`We will provide and administer a QuickBooks Online subscription for the company under our firm's wholesale agreement, including initial setup of the company file, user access for you and your team, and routine support with using the software. The subscription is charged monthly as shown in this contract and may be adjusted if the software provider changes its pricing. Your accounting data remains yours: on termination of this engagement we will, at your request, transfer the subscription to you or provide a full export of your data before access ceases.`),
  },
];

/** Schedule shown when one-off / catch-up / ad-hoc items are on the contract */
export const ADHOC_SCHEDULE: ServiceSchedule = {
  id: '_adhoc',
  title: 'Ad-hoc, Catch-up and One-off Services',
  html: ({ regBody }) =>
    p(`Where the fee structure in this contract includes one-off, catch-up or ad-hoc items, we will carry out that work as instructed on the basis of the information and records you provide, and each item is charged as a one-off fee as shown.`) +
    p(`Where you have instructed us to do so, we will provide such other ad hoc and advisory services as may be agreed between us from time to time. These services will be subject to the terms of this engagement letter and standard terms and conditions unless we decide to issue a separate engagement letter. An additional fee may be charged for these services. Examples of such work include:`) +
    ul([
      'advising on the in-year Capital Gains Tax (CGT) reporting requirements on disposals of UK residential property, and preparing the in-year return and calculating the CGT due;',
      'advising on ad hoc transactions (e.g. pre-sale advice on the sale of assets) and queries, preparing and submitting information to HMRC;',
      'advising on double tax relief if appropriate;',
      'dealing with any compliance check or enquiry opened into your tax return or tax affairs by HMRC;',
      'preparing any amended returns that may be required and corresponding with HMRC as necessary;',
      'advising on the rules relating to VAT registration and deregistration; and',
      'any other work outside the agreed scope of services.',
    ]) +
    p(`Where specialist advice is required, on occasion we may need to seek this from or refer you to appropriate specialists. We will only do this when instructed by you.`) +
    p(`For any further services not listed in this contract, our Schedule of Service Charges (Annex A) applies; where the value of additional work will exceed £200 we will confirm the scope and fee in writing (or issue a new or amended engagement letter) before starting.`) +
    p(`Our services as detailed above are subject to the limitations on our liability set out in the engagement letter. These are important provisions that you should read and consider carefully. We are bound by the ethical guidelines of ${regBody}${regBody === 'ACCA' ? ' (www.accaglobal.com)' : ' (www.icaew.com)'}.`),
};

/**
 * Assemble the dynamic Schedule of Services for the selected services.
 * Returns '' when nothing matches (letter falls back to the ad-hoc schedule).
 */
export function buildSchedulesHtml(opts: {
  serviceIds: string[];
  hasOneoff: boolean;
  firmName: string;
  regBody: string;
}): string {
  const ctx = { firmName: opts.firmName, regBody: opts.regBody };
  const selected = SERVICE_SCHEDULES.filter((s) => opts.serviceIds.includes(s.id));
  const schedules = [...selected, ...(opts.hasOneoff || selected.length === 0 ? [ADHOC_SCHEDULE] : [])];

  return schedules
    .map(
      (s, i) => `
  <h2>Schedule ${String.fromCharCode(65 + i)} — ${s.title}</h2>
  <div class="schedule-body">
  ${s.html(ctx)}
  </div>`
    )
    .join('\n');
}
