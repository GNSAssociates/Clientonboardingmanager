/* eslint-disable react/no-unescaped-entities */
/**
 * Full engagement letter body — reproduces the GNS Associates Word template
 * ("Engagement Letter GNS") verbatim, parameterised per firm so the same
 * contract is issued by all three firms.
 */
import Image from 'next/image';
import type { FirmConfig } from '@/lib/firms';

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[15px] font-bold text-gray-900 mt-6 mb-2">{children}</h3>
);
const SubH = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-[14px] font-bold text-gray-800 mt-4 mb-1.5">{children}</h4>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13.5px] text-gray-700 leading-relaxed mb-3 text-justify">{children}</p>
);
const UL = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-6 mb-3 space-y-1">
    {items.map((it, i) => (
      <li key={i} className="text-[13.5px] text-gray-700 leading-relaxed">{it}</li>
    ))}
  </ul>
);

export function LetterTerms({ firm, companyName }: { firm: FirmConfig; companyName: string }) {
  const shortName = firm.name;
  return (
    <div>
      <p className="text-[13.5px] text-gray-700 mb-1 font-semibold">The directors</p>
      <p className="text-[13.5px] text-gray-700 mb-3 font-semibold">{companyName}</p>
      <P>Dear Sir/s</P>
      <P>
        We are pleased to accept the instruction to act as accountant for your company and are writing to
        confirm the terms of our appointment.
      </P>
      <P>
        The purpose of this letter, together with the attached terms and conditions, is to set out our terms
        for carrying out the work and to clarify our respective responsibilities.
      </P>
      <P>
        We are bound by the ethical guidelines of {firm.regBody} and accept instructions to act for you on the
        basis that we will act in accordance with those ethical guidelines. A copy of these guidelines can be
        viewed at our offices on request{firm.regBody === 'ACCA' ? ' or at www.accaglobal.com' : ''}.
      </P>

      <H>Period of engagement</H>
      <P>This letter is effective from the date signed.</P>
      <P>
        We will deal with matters arising in respect of periods prior to the above date as appropriate should
        there be any such requirement.
      </P>

      <H>Scope of services to be provided</H>
      <SubH>Our responsibility to you</SubH>
      <P>
        We have set out the agreed scope and objectives of your instructions within this letter of engagement.
        Any subsequent changes will be discussed with you and where appropriate a new letter of engagement will
        be agreed. We shall proceed on the basis of the instructions we have received from you and will rely on
        you to tell us as soon as possible if anything occurs which renders any information previously given to
        us as incorrect or inaccurate. We shall not be responsible for any failure to advise or comment on any
        matter that falls outside the specific scope of your instructions. We cannot accept any responsibility
        for any event, loss or situation unless it is one against which it is the expressed purpose of these
        instructions to provide protection.
      </P>

      <SubH>Your responsibility to us</SubH>
      <P>
        The advice that we give can only be as good as the information on which it is based. In so far as that
        information is provided by you, or by third parties with your permission, your responsibility arises as
        soon as possible if any circumstances or facts alter, as any alteration may have a significant impact
        on the advice given. If the circumstances change therefore or your needs alter, advise us of the
        alteration as soon as possible in writing.
      </P>

      <SubH>Statutory responsibilities</SubH>
      <P>
        As directors of the company, you are required by statute to prepare accounts (financial statements) for
        each financial year, which give a true and fair view of the state of affairs of the company and of its
        profit or loss for that period. In preparing those accounts you must:
      </P>
      <UL items={[
        'Select suitable accounting policies and then apply them consistently.',
        'Make judgements and estimates that are reasonable and prudent.',
        'Prepare the accounts on the going concern basis unless it is not appropriate to presume that the company will continue in business.',
      ]} />
      <P>You have engaged us to prepare the accounts on your behalf.</P>
      <P>
        It is your responsibility to keep proper accounting records that disclose with reasonable accuracy at
        any particular time the financial position of the company. It is also your responsibility to safeguard
        the assets of the company and to take reasonable steps for the prevention of and detection of fraud and
        other irregularities with an appropriate system of internal controls.
      </P>
      <P>
        You are responsible for determining whether, in respect of the year concerned, the company meets the
        conditions for exemption from an audit set out in section 477 of the Companies Act 2006, and for
        determining whether, in respect of the year, the exemption is not available for any of the reasons set
        out in section 478 of the Companies Act 2006.
      </P>
      <P>
        You are also responsible for making available to us, as and when required, all the company's accounting
        records and all other relevant records and related information, including minutes of management and
        shareholders' meetings.
      </P>
      <P>You will also be responsible for:</P>
      <UL items={[
        'Maintaining records of all receipts and payments of cash.',
        'Maintaining records of invoices issued and received.',
        'Reconciling balances monthly/annually with the bank statements.',
        'Preparing details of the following at the year-end: stocks and work in progress; fixed assets; amounts owing to suppliers; amounts owing by customers; and accruals and prepayments.',
      ]} />
      <P>
        Our work will not be an audit of the accounts in accordance with International Standards on Auditing
        (UK and Ireland). Accordingly, we shall not seek any independent evidence to support the entries in the
        accounting records, or to prove the existence, ownership or valuation of assets or completeness of
        income, liabilities or disclosure in the accounts. Nor shall we assess the reasonableness of any
        estimates or judgements made in the preparation of the accounts. Consequently, our work will not
        provide any assurance that the accounting records are free from material misstatement, irregularities
        or error.
      </P>
      <P>
        As part of our normal procedures we may request you to provide written confirmation of any oral
        information and explanations given to us during the course of our work.
      </P>
      <P>
        We have a professional duty to compile accounts that conform with generally accepted accounting
        principles. The accounts of a limited company are required to comply with the disclosure requirements
        of the Companies Act 2006 and applicable accounting standards. Where we identify that the accounts do
        not conform to accepted accounting principles or standards, we will inform you and suggest amendments
        be put through the accounts before being published. We have a professional responsibility not to allow
        our name to be associated with accounts that may be misleading. In extreme cases, where this matter
        cannot be resolved, we will withdraw from the engagement and notify you in writing of the reasons.
      </P>
      <P>
        Should you instruct us to carry out any alternative report it will be necessary for us to issue a
        separate letter of engagement.
      </P>

      <SubH>Our service to you</SubH>
      <P>
        We will not be carrying out any audit work as part of this assignment and accordingly will not verify
        the assets and liabilities of the company, nor the items of expenditure and income. To carry out an
        audit would entail additional work to comply with International Standards on Auditing so that we could
        report on the truth and fairness of the financial statements. We would also like to emphasise that we
        cannot undertake to discover any shortcomings in your systems or irregularities on the part of your
        employees.
      </P>
      <P>
        If an audit of the accounts is required, you will need to notify us in writing. Should our work
        indicate that the company is not entitled to exemption from an audit of the accounts, we will inform
        you. If we decide to undertake an audit assignment at your request, a separate engagement letter will
        be required.
      </P>
      <P>
        We will attach to the accounts a report developed by the Consultative Committee of Accountancy Bodies
        (CCAB) which explains what work has been done by us, the professional requirements we have to fulfil
        and the standard to which the work has been carried out. Web links are provided in the report so that
        you can obtain further information about the technical guidance for the work, and the related ethical
        and other professional requirements.
      </P>
      <P>
        To ensure that anyone reading the accounts is aware that we have not carried out an audit, we will
        attach to the accounts a report stating this fact.
      </P>
      <P>The intended users of the report are the directors. The report will be addressed to the directors.</P>
      <P>
        Once we have issued our report we have no further direct responsibility in relation to the accounts for
        that financial year. However, we expect that you will inform us of any material event occurring between
        the date of our report and that of the annual general meeting that may affect the accounts.
      </P>

      <SubH>Limitation of liability</SubH>
      <P>
        We specifically draw your attention to the limitation of liability paragraphs in our standard terms and
        conditions which set out the basis on which we limit our liability to you and to others. You should
        read this in conjunction with the limitation of third party rights paragraphs in our standard terms and
        conditions which exclude liability to third parties. These are important provisions which you should
        read and consider carefully.
      </P>
      <P>
        There are no third parties that we have agreed should be entitled to rely on the work done pursuant to
        this engagement letter.
      </P>

      <H>Other services</H>
      <P>
        You may request that we provide other services from time to time. If these services will exceed £200,
        we will issue a separate letter of engagement and scope of work to be performed accordingly.
      </P>
      <P>
        Because rules and regulations frequently change you must ask us to confirm any advice already given if
        a transaction is delayed or a similar transaction is to be undertaken.
      </P>

      <H>Data Protection</H>
      <P>
        We comply with the provisions of the General Data Protection Regulation (GDPR) when processing personal
        data about you, your directors and employees and your/their family.
      </P>
      <P>Processing means:</P>
      <UL items={[
        'obtaining, recording or holding personal data; or',
        'carrying out any operation or set of operations on personal data, including collecting and storage, organising, adapting, altering, using, disclosure (by any means) or removing (by any means) from the records manual and digital.',
      ]} />
      <P>The information we obtain, process, use and disclose will be necessary for:</P>
      <UL items={[
        'the performance of the contract',
        'to comply with our legal and regulatory compliance and crime prevention',
        'contacting you with details of other services where you have consented to us doing so',
        'other legitimate interests relating to protection against potential claims and disciplinary action against us.',
      ]} />
      <P>
        This includes, but is not limited to, purposes such as updating and enhancing our client records,
        analysis for management purposes and statutory returns.
      </P>
      <P>
        In regard to our professional obligations we are a member firm of the {firm.regBody}. Under the ethical
        and regulatory rules of {firm.regBody}, we are required to allow access to client files and records for
        the purpose of maintaining our membership of this body.
      </P>
      <P>
        Further details on the processing of data are contained in our privacy notice, which should be read
        alongside these terms and conditions.
      </P>

      <SubH>Requirements of the Data Protection Act (DPA) 2018 and the General Data Protection Regulation (GDPR)</SubH>
      <P>The DPA 2018 and GDPR set out a number of requirements in relation to the processing of personal data.</P>
      <P>
        Here at {shortName}, we take your privacy and the privacy of the information we process seriously. We
        will only use your personal information and the personal information you give us access to under this
        contract to administer your account and to provide the services you have requested from us.
      </P>
      <P>
        We attach our privacy notice setting out our approach to handling your information. In signing this
        letter you will be indicating that you have read and agreed the terms under which we operate as set out
        in this notice. In addition, please note that we require your agreement on several specific points,
        which are also included in the acceptance section below:
      </P>
      <SubH>(a) Continuity arrangements</SubH>
      <P>
        Please note that we have arrangements in place for an alternate to deal with matters in the event of
        permanent incapacity or illness. This provides protection to you in the event that we cannot act on
        your behalf, and in signing this letter you agree to the alternate having access to all of the
        information we hold in order to make initial contact with you and agree the work to be undertaken
        during any incapacity. You can choose to appoint another agent at that stage if you wish.
      </P>
      <SubH>(b) Secure communications and transfer of data</SubH>
      <P>We will communicate or transfer data using the following:</P>
      <UL items={[
        'Post/hard-copy documents [by normal or recorded delivery]',
        'Password-protected attachments in emails',
        'Encrypted emails',
        'Adobe documents cloud (Cloud-based software for electronic signature)',
        'Emails *',
        'Social media – Text, Viber, Whatsapp',
      ]} />
      <P>
        * If you require us to correspond with you by email that is not encrypted or password protected, you
        also accept the risks associated with this form of communication.
      </P>

      <H>Agreement of terms</H>
      <P>
        This letter supersedes any previous engagement letter. Once it has been agreed, this letter will remain
        effective until it is replaced.
      </P>
      <P>
        You or we may vary or terminate our authority to act on your behalf at any time without penalty. Notice
        of variation or termination must be given in writing.
      </P>
      <P>
        We would be grateful if you could confirm your agreement to the terms of this letter by signing in the
        acceptance section below.
      </P>
      <P>
        If this letter is not in accordance with your understanding of the scope of our engagement or your
        circumstances have changed, please let us know. This letter should be read in conjunction with the
        firm's standard terms and conditions.
      </P>

      <P>Yours sincerely,</P>
      <div className="my-4">
        <Image src={firm.signatureImg} alt="" width={150} height={75} className="object-contain" />
        <p className="text-[13.5px] text-gray-900 font-semibold mt-1">{firm.partnerName}</p>
        <p className="text-[12.5px] text-gray-600">For and on behalf of, {firm.legalName}</p>
      </div>
      <P>
        I/We confirm that I/we have read and understood the contents of this letter and related terms and
        conditions and agree that it accurately reflects my/our fair understanding of the services that I/we
        require you to undertake.
      </P>
    </div>
  );
}

export function ScheduleOfServices() {
  return (
    <div>
      <h3 className="text-center text-[15px] font-bold text-gray-900 tracking-wide mb-2 mt-2">SCHEDULE OF SERVICES</h3>
      <P>
        This schedule should be read in conjunction with the engagement letter and the terms and conditions of
        business.
      </P>
      <p className="text-[13px] font-bold text-gray-800 mb-3">
        PREPARATION OF STATUTORY FINANCIAL STATEMENTS IN COMPLIANCE WITH THE COMPANIES ACT 2006
      </p>

      <SubH>1.0 Responsibilities and scope for financial statements preparation services</SubH>

      <SubH>1.1 Your responsibilities as directors</SubH>
      <P>
        1.1.1 As directors of the company, you are responsible for preparing financial statements which give a
        true and fair view and which have been prepared in accordance with the Companies Act 2006 (the Act). As
        directors you must not approve the financial statements unless you are satisfied that they give a true
        and fair view of the assets, liabilities, financial position and profit or loss of the company.
      </P>
      <P>1.1.2 In preparing the financial statements, you are required to:</P>
      <UL items={[
        'select suitable accounting policies and then apply them consistently;',
        'make judgements and estimates that are reasonable and prudent; and',
        'prepare the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.',
      ]} />
      <P>
        1.1.3 You are responsible for keeping adequate accounting records that set out with reasonable accuracy
        at any time the company's financial position, and for ensuring that the financial statements comply
        with United Kingdom Accounting Standards (UK GAAP) and with the Companies Act 2006 and give a true and
        fair view.
      </P>
      <P>
        1.1.4 You are also responsible for safeguarding the assets of the company and hence for taking
        reasonable steps to prevent and detect fraud and other irregularities.
      </P>
      <P>
        1.1.5 You are also responsible for deciding whether, in each financial year, the company meets the
        conditions for exemption from an audit, as set out in section 477 or 480 of the Companies Act 2006, and
        for deciding whether the exemption cannot be claimed that year.
      </P>
      <P>
        1.1.6 You are responsible for ensuring that the company complies with laws and regulations that apply
        to its activities, and for preventing non-compliance and detecting any that occurs.
      </P>
      <P>
        1.1.7 You have undertaken to make available to us, as and when required, all the company's accounting
        records and related financial information, including minutes of management and members' meetings that
        we need to do our work.
      </P>
      <P>
        1.1.8 If financial information is published, which includes a report by us or is otherwise connected to
        us, on the company's website or by other electronic means, you must inform us of the electronic
        publication and get our consent before it occurs and ensure that it presents the financial information
        and report properly. We have the right to withhold consent to the electronic publication of our report
        or the financial statements if they are to be published in an inappropriate manner.
      </P>
      <P>
        1.1.9 You must set up controls to prevent or detect quickly any changes to electronically published
        information. We are not responsible for reviewing these controls nor for keeping the information under
        review after it is first published. You are responsible for the maintenance and integrity of
        electronically published information, and we accept no responsibility for changes made to any
        information after it is first posted.
      </P>

      <SubH>1.2 Our responsibilities as accountants</SubH>
      <P>
        1.2.1 You have asked us to help you prepare the financial statements in accordance with the
        requirements of the Companies Act 2006, to enable profits to be calculated to meet the requirements of
        current tax legislation and that provide sufficient and relevant information to complete a tax return.
        We will compile the financial statements for your approval based on the accounting records and the
        information and explanations that you give us.
      </P>
      <P>
        1.2.2 We shall plan our work on the basis that no report on the financial statements is required by
        statute or regulation for the year, unless you inform us in writing to the contrary. We will make
        enquiries of management and undertake any procedures that we judge appropriate but are under no
        obligation to perform procedures that may be required for assurance engagements such as audits or
        reviews.
      </P>
      <P>
        1.2.3 You have told us that the company is exempt from an audit of the financial statements. We will
        not check whether this is the case. However, if we find that the company is not entitled to the
        exemption, we will inform you of this.
      </P>
      <P>
        1.2.4 Our work will not be an audit of the financial statements in accordance with International
        Standards of Auditing (UK and Ireland). So we will not be able to provide any assurance that the
        accounting records or the financial statements are free from material misstatement, whether caused by
        fraud, other irregularities or error nor to identify weaknesses in internal controls.
      </P>
      <P>
        1.2.5 Since we will not carry out an audit, nor confirm in any way the accuracy or reasonableness of
        the accounting records, we cannot provide any assurance whether the financial statements that we
        prepare from those records will present a true and fair view.
      </P>
      <P>
        1.2.6 We will advise you on whether your records are adequate for preparation of the financial
        statements and recommend improvements.
      </P>
      <P>
        1.2.7 We have a professional duty to compile financial statements that conform with generally accepted
        accounting principles from the accounting records and information and explanations given to us. The
        accounting policies on which the financial statements have been compiled will be disclosed in an
        accounting policy and will be referred to in our accountants' report. We will not compile financial
        statements where the accounting principles, or the accounting policies selected by management are
        inappropriate.
      </P>
      <P>
        1.2.8 We also have a professional responsibility not to allow our name to be associated with financial
        statements which we believe may be misleading. Therefore, although we are not required to search for
        such matters, should we become aware, for any reason, that the financial statements may be misleading,
        we will discuss the matter with you with a view to agreeing appropriate adjustments and/or disclosures
        in the financial statements. In circumstances where adjustments and/or disclosures that we consider
        appropriate are not made or where we are not provided with appropriate information, and as a result we
        consider that the financial statements are misleading, we will withdraw from the engagement.
      </P>
      <P>
        1.2.9 As part of our normal procedures we may ask you to confirm in writing any information or
        explanations given to us orally during our work.
      </P>

      <SubH>1.3 Form of the accountants' report</SubH>
      <P>
        1.3.1 We will report to the Board of Directors, as appropriate, that in accordance with this engagement
        letter and to assist you to fulfil your responsibilities, we have not carried out an audit but have
        compiled the financial statements from the accounting records and from the information and explanations
        supplied to us. To the fullest extent permitted by law, we do not accept or assume responsibility to
        anyone other than the Company and the Company's Board of Directors, as a body, for our work or for this
        report.
      </P>
    </div>
  );
}
