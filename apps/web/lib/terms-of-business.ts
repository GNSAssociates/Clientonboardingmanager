/**
 * Terms of Business for engagement letters.
 *
 * Based on ICAEW Engagement Letters Helpsheet Part 4 (March 2026 edition),
 * tailored for GNS Associates / Galaxy Accountancy / GNS LLP.
 *
 * These are appended to the engagement letter after the Schedule of Services
 * and before Annex A (SSC). The regBody parameter selects ICAEW- or
 * ACCA-specific language where wording differs.
 */

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildTermsOfBusinessHtml(opts: {
  firmName: string;
  firmLegalName: string;
  firmAddress: string;
  regBody: string;
  firmEmail: string;
}): string {
  const { firmName, firmLegalName, firmAddress, regBody, firmEmail } = opts;
  const isICAEW = regBody === 'ICAEW';
  const bodyWebsite = isICAEW ? 'www.icaew.com' : 'www.accaglobal.com';
  const bodyFullName = isICAEW
    ? 'the Institute of Chartered Accountants in England and Wales (ICAEW)'
    : 'the Association of Chartered Certified Accountants (ACCA)';
  const ethicsRef = isICAEW
    ? 'ICAEW\'s Code of Ethics, which can be viewed at www.icaew.com/technical/trust-and-ethics/ethics/code-of-ethics'
    : 'ACCA\'s Code of Ethics and Conduct, which can be viewed at www.accaglobal.com';

  return `
  <hr class="divider">
  <h1 style="letter-spacing:1px">TERMS OF BUSINESS</h1>
  <p>The following terms of business apply to all engagements accepted by ${esc(firmLegalName)}. All work is carried out under these terms except where changes are expressly agreed in writing.</p>

  <h3>1. Applicable law</h3>
  <p>Our engagement letter, the schedules of services and these terms of business are governed by, and should be construed in accordance with, English law. Each party agrees that the courts of England will have exclusive jurisdiction in relation to any claim, dispute or difference concerning this engagement letter and any matter arising from it on any basis. Each party irrevocably waives any right to object to any action being brought in those courts, to claim that the action has been brought in an inappropriate forum, or to claim that those courts do not have jurisdiction.</p>
  <p>We will not accept responsibility if you act on advice previously given by us without first confirming with us that the advice is still valid in light of any change in the law or in your circumstances. We will accept no liability for losses arising from changes in the law, or the interpretation thereof, that occur after the date on which the advice is given.</p>

  <h3>2. Client identification</h3>
  <p>As with other professional services firms, we are required to identify our clients for the purposes of the UK anti-money laundering legislation. We may request from you, and retain, such information and documentation as we require for these purposes and/or make searches of appropriate databases. If we are not able to obtain satisfactory evidence of your identity, we will not be able to proceed with the engagement.</p>
  <p>Any personal data received from you to comply with our obligations under The Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017 as amended by the 2022 regulations (MLR 2017) will be processed only for the purposes of preventing money laundering or terrorist financing.</p>

  <h3>3. Confidentiality</h3>
  <p>Unless we are authorised by you to disclose information on your behalf, we confirm that if you give us confidential information we will, at all times during and after this engagement, keep it confidential, except as required by law or as provided for in regulatory, ethical or other professional pronouncements applicable to us or our engagement.</p>
  <p>You agree that, if we act for other clients who are or who become your competitors, to comply with our duty of confidentiality it will be sufficient for us to take such steps as we think appropriate to preserve the confidentiality of information given to us by you, both during and after this engagement.</p>
  <p>In addition, if we act for other clients whose interests are or may be adverse to yours, we will manage the conflict by implementing additional safeguards to preserve confidentiality. Safeguards may include measures such as separate teams, physical separation of teams, and separate arrangements for storage of, and access to, information.</p>
  <p>We may, on occasion, subcontract work on your affairs to other tax or accounting professionals. The subcontractors will be bound by our client confidentiality terms. We will inform you of the proposed use of a subcontractor before they commence work, except where your data will not be transferred out of our systems and the subcontractor is bound by confidentiality terms equivalent to an employee.</p>

  <h3>4. Conflicts of interest</h3>
  <p>We will inform you if we become aware of any conflict of interest in our relationship with you or in our relationship with you and another client, unless we are unable to do so because of our confidentiality obligations. If conflicts are identified which cannot be managed in a way that protects your interests, we regret that we will be unable to provide further services.</p>
  <p>If there is a conflict of interest that is capable of being addressed successfully by the adoption of suitable safeguards to protect your interests, we will adopt those safeguards. In resolving the conflict, we would be guided by ${ethicsRef}.</p>

  <h3>5. Commissions or other benefits</h3>
  <p>In some circumstances we may receive commissions or other benefits for introductions to other professionals or in respect of transactions which we arrange for you. If this happens, we will notify you in writing of the amount and terms of payment and receipt of any such commissions or benefits.</p>

  <h3>6. Electronic and other communication</h3>
  <p>Unless you instruct us otherwise, we may, if appropriate, communicate with you and with third parties by email or other electronic means. The recipient is responsible for virus checking emails and any attachments.</p>
  <p>With electronic communication, there is a risk of non-receipt, delayed receipt, inadvertent misdirection or interception by third parties. We use virus-scanning software to reduce the risk of viruses and similar damaging items being transmitted in emails or by electronic storage devices. Nevertheless, electronic communication is not totally secure and we cannot be held responsible for damage or loss caused by viruses or for communications which are corrupted or altered after despatch. Nor can we accept any liability for problems or accidental errors relating to this means of communication, especially in relation to commercially sensitive material.</p>
  <p>Any communication by us with you sent through the postal system is deemed to arrive at your postal address two working days after the day the document was sent.</p>

  <h3>7. Fees and payment terms</h3>
  <p>Our fees may depend not only upon the time spent on your affairs, but also on the level of skill and responsibility and the importance and value of the advice we provide, as well as the level of risk.</p>
  <p>If we provide you with an estimate of our fees for any specific work, the estimate will not be contractually binding unless we explicitly state that will be the case.</p>
  <p>In some cases, you may be entitled to assistance with your professional fees, particularly in relation to any investigation into your tax affairs by HMRC. Assistance may be provided through insurance policies you hold or via membership of a professional or trade body. You will remain liable for our fees regardless of whether all or part are liable to be paid by your insurers.</p>
  <p>Unless otherwise agreed, our fees do not include the costs of any third party, counsel or other professional fees. If these costs are incurred to fulfil our engagement, such necessary additional charges may be payable by you.</p>
  <p>We reserve the right to charge interest on late-paid invoices at the rate of 8% above bank base rates under the Late Payment of Commercial Debts (Interest) Act 1998. We also reserve the right to suspend our services or to cease to act for you, having given written notice, if payment of any fees is unduly delayed. We intend to exercise these rights only if it is fair and reasonable to do so.</p>
  <p>If you do not accept that an invoiced fee is fair and reasonable, you must notify us within 21 days of receipt, failing which, you will be deemed to have accepted that payment is due.</p>

  <h3>8. Limitation of liability and third party rights</h3>
  <p>We will provide our services with reasonable care and skill. Our liability to you is limited to losses, damages, costs and expenses directly caused by our breach of contract, negligence, fraud or wilful default.</p>
  <p>We will not be liable if such losses are caused by the acts or omissions of any other person or due to the provision to us of incomplete, misleading or false information, or if they are caused by a failure to act on our advice or a failure to provide us with relevant information.</p>
  <p>We will not be liable to you for any delay or failure to perform our obligations under the engagement letter if the delay or failure is caused by circumstances outside our reasonable control.</p>
  <p>We will not be responsible or liable for any loss, damage or expense incurred or sustained if information material to the service we are providing is withheld or concealed from us or misrepresented to us. This applies equally to fraudulent acts, misrepresentation or wilful default on the part of any party to the transaction and their directors, officers, employees, agents or advisors.</p>
  <p>If you, or any party on your behalf, fails to provide information to us by the deadlines requested by us, or does not provide us with full and accurate information by those deadlines, we shall not be responsible for any losses arising as a result of any subsequent failure by us to meet any filing or other dates on your behalf.</p>
  <p>The advice and information we provide to you as part of our services is for your sole use and not for any third party to whom you may communicate it unless we have expressly agreed in the engagement letter that a specified third party may rely on our work. We accept no responsibility to third parties, including any group company to whom the engagement letter is not addressed, for any advice, information or material produced as part of our work for you.</p>
  <p>A party to this agreement is the only person who has the right to enforce any of its terms and no rights or benefits are conferred on any third party under the Contracts (Rights of Third Parties) Act 1999.</p>

  <h3>9. Professional rules and statutory obligations</h3>
  <p>We will observe and act in accordance with the Bye-laws, regulations and Code of Ethics of ${esc(regBody)}${isICAEW ? ', including Professional Conduct in Relation to Taxation,' : ''} and will accept instructions to act for you on this basis. We will not be liable for any loss, damage or cost arising from our compliance with statutory or regulatory obligations. You can see copies of these requirements at ${bodyWebsite}.</p>

  <h3>10. Quality control</h3>
  <p>As part of our ongoing commitment to provide a quality service, our files are periodically reviewed by an independent regulatory or quality control body. These reviewers are highly experienced professionals and are bound by the same rules of confidentiality as our staff.</p>
  ${isICAEW ? `<p>When dealing with HMRC on your behalf we are required to follow Professional Conduct in Relation to Taxation. To enable us to do this, you are required to be honest with us and to provide us with all necessary information in a timely manner.</p>` : ''}

  <h3>11. Retention of papers</h3>
  <p>You have a legal responsibility to retain documents and records relevant to your financial affairs. During the course of our work we may collect information from you and others relevant to your tax and financial affairs. We will return any original documents to you if requested. Documents and records relevant to your tax affairs are required by law to be retained as follows:</p>
  <ul>
    <li>Individuals, trustees and partnerships: with trading or rental income — five years and 10 months after the end of the tax year; otherwise — 22 months after the end of the tax year.</li>
    <li>Companies, Limited Liability Partnerships, and other corporate entities — six years from the end of the accounting period.</li>
  </ul>
  <p>Although certain documents may legally belong to you, we may destroy correspondence and other papers that we store electronically or otherwise that are more than seven years old, except documents we think may be of continuing significance. You must tell us if you wish us to keep any document for any longer period.</p>

  <h3>12. Lien</h3>
  <p>Insofar as we are permitted to do so by law or by professional guidelines, we reserve the right to exercise a lien over all funds, documents and records in our possession relating to all engagements for you until all outstanding fees and disbursements are paid in full.</p>

  <h3>13. Intellectual property rights</h3>
  <p>We will retain all intellectual property rights in any document prepared by us during the course of carrying out the engagement except where the law specifically states otherwise. You are not permitted to use our name in any statement or document you may issue unless our prior written consent has been obtained.</p>

  <h3>14. Period of engagement and termination</h3>
  <p>Unless otherwise agreed in the engagement letter, our work will begin when we receive implicit or explicit acceptance of that letter. Except as stated in that letter, we will not be responsible for periods before that date.</p>
  <p>Each of us may terminate our agreement by giving not less than 21 days' notice in writing to the other party, except if you fail to cooperate with us or we have reason to believe that you have provided us or HMRC with misleading information, in which case we may terminate this agreement immediately. Termination will be without prejudice to any rights that may have accrued to either of us before termination.</p>
  <p>We reserve the right to terminate the engagement between us with immediate effect in the event of: your insolvency, bankruptcy or other arrangement being reached with creditors; an independence issue or change in the law which means we can no longer act; failure to pay our fees by the due dates; or either party being in breach of their obligations if this is not corrected within 30 days of being asked to do so.</p>

  <h3>15. Disengagement</h3>
  <p>If we resign, or are asked to resign, we will normally issue a disengagement letter to ensure that our respective responsibilities are clear.</p>

  <h3>16. Reliance on advice</h3>
  <p>We will endeavour to record all advice on important matters in writing. Advice given orally is not intended to be relied upon unless confirmed in writing. Therefore, if we provide oral advice (for example, during the course of a meeting or a telephone conversation) and you wish to be able to rely on that advice, you must ask for the advice to be confirmed by us in writing. Advice is valid as at the date it was given.</p>

  <h3>17. Complaints</h3>
  <p>We are committed to providing you with a high-quality service that is both efficient and effective. If at any point you would like to discuss how our service could be improved, or if you are dissatisfied with the service you are receiving, please let us know by contacting us at ${esc(firmEmail)}.</p>
  <p>We will consider carefully any complaint you may make about our service as soon as we receive it and do all we can to explain the position to you. We will acknowledge your communication within five business days and endeavour to deal with your complaint within eight weeks.</p>
  <p>If we do not answer your complaint to your satisfaction, you may take up the matter with our professional body, ${esc(regBody)}.${isICAEW ? '' : ' Details of ACCA\'s complaints process can be found at www.accaglobal.com.'}</p>

  <h3>18. Use of software and AI</h3>
  <p>We may use software programmes, Artificial Intelligence ('AI') and internal and external search engines in the performance of the services that we provide to you. In engaging with us, you consent to us doing so. We will not do so in a way that will breach any duties of confidentiality that we owe you and we will do so with reasonable skill and care and in accordance with the usual duties owed by professional accountants to their clients.</p>
  <p>We are not responsible for any failure to deliver our services due to errors in transmission, internet outages, supplier infrastructure issues or any other failure that results in lack of availability of the software programmes or other online services required to enable us to provide you with our services.</p>

  <h3>19. Interpretation</h3>
  <p>If any provision of our engagement letter or terms of business is held to be void, that provision will be deemed not to form part of this contract. In the event of any conflict between these terms of business and the engagement letter or schedules, the relevant provision in the engagement letter or schedules will take precedence.</p>

  <h3>20. Timing of our services</h3>
  <p>If you provide us with all information and explanations on a timely basis in accordance with our requirements, we will plan to undertake the work within a reasonable period of time to meet any regulatory deadlines. However, failure to complete our services before any such regulatory deadline would not, of itself, mean that we are liable for any penalty or additional costs arising.</p>
  <p>Please note that we accept no liability for delays in the provision of our services where such delays are as a result of HMRC services and access issues.</p>

  <h3>21. Internal disputes within a client</h3>
  <p>If we become aware of a dispute between the parties who own the business or who are in some way involved in its ownership and management, it should be noted that our client is the business and we would not provide information or services to one party without the express knowledge and permission of all parties. Unless otherwise agreed by all parties, we will continue to supply information to the registered office or normal place of business for the attention of the directors, partners or trustees as applicable.</p>
`;
}

/**
 * Privacy Notice section — ICAEW Part 5 compliant, tailored for GNS.
 */
export function buildPrivacyNoticeHtml(opts: {
  firmName: string;
  firmLegalName: string;
  firmAddress: string;
  regBody: string;
  firmEmail: string;
  companyNumber?: string;
}): string {
  const { firmLegalName, firmAddress, regBody, firmEmail } = opts;

  return `
  <hr class="divider">
  <h1 style="letter-spacing:1px">PRIVACY NOTICE</h1>

  <h3>About us and the purpose of this notice</h3>
  <p>${esc(firmLegalName)} is an accountancy and tax advisory firm registered in England and Wales. Our registered office is at ${esc(firmAddress)}.</p>
  <p>This notice will tell you how we look after your personal data, about your privacy rights, and about our compliance with and your protections under Data Protection Legislation.</p>
  <p>In this notice "Data Protection Legislation" means any applicable law relating to the processing, privacy, and use of Personal Data, including the Data Protection Act 2018, the Privacy and Electronic Communications (EC Directive) Regulations 2003 as amended, and the Data (Use and Access) Act 2025.</p>
  <p>For the purpose of the Data Protection Legislation and this notice, we are the 'data controller'. This means that we are responsible for deciding how we hold and use personal data about you. We are required under the Data Protection Legislation to notify you of the information contained in this privacy notice.</p>

  <h3>The kind of information we hold about you</h3>
  <p>The information we hold about you may include the following:</p>
  <ul>
    <li>your personal details (such as your name, address, date of birth, national insurance number, UTR);</li>
    <li>details of contact we have had with you in relation to the provision, or the proposed provision, of our services;</li>
    <li>details of any services you have received from us;</li>
    <li>our correspondence and communications with you;</li>
    <li>information about any complaints and enquiries you make to us;</li>
    <li>financial information such as bank details, salary details, tax codes and investment details.</li>
  </ul>

  <h3>How we may collect your personal data</h3>
  <p>We obtain your personal data directly from you when:</p>
  <ul>
    <li>you request a proposal from us in respect of the services we provide;</li>
    <li>you engage us to provide our services and also during the provision of those services;</li>
    <li>you contact us by email, telephone, post or social media.</li>
  </ul>
  <p>We may also obtain your personal data indirectly from your employer when they engage us to provide services, or from third parties and/or publicly available resources (for example, from Companies House or HMRC).</p>

  <h3>How we use personal data we hold about you</h3>
  <p>We may process your personal data for purposes necessary for the performance of our contract with you and to comply with our legal obligations. We may also process your personal data for the purposes of our own legitimate interests provided that those interests do not override any of your own interests, rights and freedoms which require the protection of personal data.</p>
  <p>We may use your personal data in order to:</p>
  <ul>
    <li>carry out our obligations arising from any agreements entered into between you and us (which will most usually be for the provision of our services);</li>
    <li>provide you with information related to our services and our events or seek your thoughts and opinions on the services we provide;</li>
    <li>notify you about any changes to our services.</li>
  </ul>
  <p>In some circumstances we may anonymise or pseudonymise the personal data so that it can no longer be associated with you, in which case we may use it without further notice to you.</p>

  <h3>Data retention</h3>
  <p>We will only retain your personal data for as long as is necessary to fulfil the purposes for which it is collected. When assessing what retention period is appropriate for your personal data, we take into consideration the requirements of our business and the services provided, any statutory or legal obligations and the purposes for which we originally collected the personal data.</p>

  <h3>Data sharing</h3>
  <p>We will share your personal data with third parties where we are required by law, where it is necessary to administer the relationship between us, or where we have another legitimate interest in doing so. This may include sharing your personal data with a regulator or to otherwise comply with the law.</p>
  <p>"Third parties" includes third-party service providers and other entities. The following activities are carried out by third-party service providers: IT and cloud services, professional advisory services, administration services, payment processing and banking services. We only permit our third-party service providers to process your personal data for specified purposes and in accordance with our instructions.</p>

  <h3>Transferring personal data outside the United Kingdom (UK)</h3>
  <p>We will not transfer the personal data we collect about you outside of the UK unless required to do so by law, in which case we will ensure appropriate safeguards are in place.</p>

  <h3>Data security</h3>
  <p>We have put in place commercially reasonable and appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know. They will only process your personal data on our instructions, and they are subject to a duty of confidentiality.</p>
  <p>We have put in place procedures to deal with any suspected data security breach and will notify you and any applicable regulator of a suspected breach where we are legally required to do so.</p>

  <h3>Your rights</h3>
  <p>It is important that the personal data we hold about you is accurate and current. Should your personal information change, please notify us of any changes. Under certain circumstances, by law you have the right to:</p>
  <ul>
    <li><strong>Request access</strong> to your personal data — this enables you to receive details of the personal data we hold about you and to check that we are processing it lawfully.</li>
    <li><strong>Request correction</strong> of the personal data that we hold about you.</li>
    <li><strong>Request erasure</strong> of your personal data — this enables you to ask us to delete or remove personal data where there is no good reason for us continuing to process it.</li>
    <li><strong>Object to processing</strong> of your personal data where we are relying on a legitimate interest (or those of a third party) and there is something about your particular situation which makes you want to object to processing on this basis.</li>
    <li><strong>Request the restriction of processing</strong> of your personal data — this enables you to ask us to suspend the processing of personal data about you.</li>
    <li><strong>Request the transfer</strong> of your personal data to you or another data controller if the processing is based on consent and carried out by automated means.</li>
  </ul>
  <p>You will not have to pay a fee to access your personal data (or to exercise any of the other rights). However, we may charge a reasonable fee for the administrative costs of complying with the request if your request is manifestly unfounded or excessive.</p>

  <h3>Right to withdraw consent</h3>
  <p>In the limited circumstances where you may have provided your consent to the collection, processing and transfer of your personal data for a specific purpose, you have the right to withdraw your consent for that specific processing at any time. To withdraw your consent, please contact us at ${esc(firmEmail)}. Once we have received notification that you have withdrawn your consent, we will no longer process your personal information for the purpose or purposes you originally agreed to, unless we have another legitimate basis for doing so in law.</p>

  <h3>Changes to this notice</h3>
  <p>Any changes we may make to our privacy notice in the future will be provided to you by email or updated on our website.</p>

  <h3>Contact us</h3>
  <p>If you have any questions regarding this notice or if you would like to speak to us about the manner in which we process your personal data, please email us at ${esc(firmEmail)}.</p>
  <p>You also have the right to make a complaint to the Information Commissioner's Office (ICO), the UK supervisory authority for data protection issues, at any time. The ICO can be contacted at <strong>https://ico.org.uk/global/contact-us/</strong> or by telephone on <strong>0303 123 1113</strong>.</p>
`;
}
