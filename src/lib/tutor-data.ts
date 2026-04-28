// ─────────────────────────────────────────────────────────────
// CYBERMENTOR KNOWLEDGE BASE & CURRICULUM DATA
// ─────────────────────────────────────────────────────────────

export const KB = `=== CYBERMENTOR KNOWLEDGE BASE — 2026 EDITION ===

[SECURITY FUNDAMENTALS]
CIA Triad: Confidentiality (only authorized access), Integrity (data accurate & unaltered), Availability (accessible when needed). DAD threats: Disclosure, Alteration, Destruction.
AAA: Authentication (who are you), Authorization (what can you do), Accounting (log what you did).
Defense in Depth: multiple layered controls. Least Privilege: minimum access needed. Zero Trust: never trust, always verify, assume breach, use micro-segmentation.
Risk = Threat × Vulnerability × Asset Value. Risk responses: accept, mitigate, transfer, avoid.
Security controls: Preventive (stop attacks), Detective (find attacks), Corrective (fix after), Deterrent (discourage), Compensating (alternative control).
Non-repudiation: ensuring a party cannot deny sending or receiving data. Accountability: tracing actions to individuals.

[NETWORKING]
OSI 7 layers: Physical→Data Link→Network→Transport→Session→Presentation→Application.
TCP 3-way handshake: SYN→SYN-ACK→ACK. TCP reliable/connection-oriented; UDP fast/connectionless.
Key ports: HTTP 80, HTTPS 443, FTP 21, SSH 22, Telnet 23, SMTP 25, DNS 53, DHCP 67/68, RDP 3389, SMB 445, LDAP 389, Kerberos 88.
DNS poisoning: corrupts DNS cache to redirect traffic. ARP poisoning: maps attacker MAC to legitimate IP (MITM on LAN).
Firewall types: packet filtering, stateful, application layer (L7), next-gen (NGFW with IPS+DPI).
IDS: detects+alerts. IPS: detects+blocks. NIDS=network-based; HIDS=host-based.
DMZ: segment between internet and internal network for public-facing servers.
VLAN: logical network segmentation. Microsegmentation: divide network into isolated zones to prevent lateral movement.
SASE: converges network security with WAN for distributed workforce.

[CRYPTOGRAPHY]
Symmetric: same key encrypts+decrypts. Fast. Algorithms: AES-256 (gold standard), DES (broken), 3DES (deprecated).
Asymmetric: public key encrypts, private key decrypts. Slow. Solves key distribution. RSA, ECC, Diffie-Hellman.
Hybrid: asymmetric exchanges symmetric key, then symmetric for bulk data (how TLS works).
Hashing: one-way. MD5/SHA-1=broken. SHA-256=secure. bcrypt/Argon2 for passwords (deliberately slow with salt).
HMAC: hash+secret key. Proves integrity AND authenticity. Digital signature: hash encrypted with private key.
TLS 1.3: current standard. PKI manages certificates. Certificate Authority (CA) issues digital certificates.
Common attacks: brute force, dictionary, rainbow table (defeated by salt), birthday attack, padding oracle, timing attack.

[POST-QUANTUM CRYPTOGRAPHY — NIST 2024 STANDARDS]
Quantum threat: Shor's algorithm breaks RSA/ECC. Grover's algorithm halves symmetric key strength.
NIST PQC Standards: FIPS 203 (ML-KEM/Kyber — encryption), FIPS 204 (ML-DSA/Dilithium — signatures), FIPS 205 (SLH-DSA/SPHINCS+).
Crypto-agility: designing systems to swap cryptographic algorithms without full redesign.
Harvest now, decrypt later: attackers collect encrypted data today to decrypt when quantum computers arrive.
Timeline: deprecate RSA/ECC by 2030, full migration to PQC by 2035.

[WEB APP SECURITY / OWASP TOP 10]
A01 Broken Access Control: IDOR, privilege escalation, directory traversal.
A02 Cryptographic Failures: weak encryption, hardcoded keys, HTTP instead of HTTPS.
A03 Injection: SQLi (parameterized queries fix), Command injection, XXE.
A04 Insecure Design: no threat modeling, no rate limiting, flawed business logic.
A05 Security Misconfiguration: default creds, open admin panels, public S3 buckets.
A06 Vulnerable Components: outdated libraries. Log4Shell (CVE-2021-44228) — CVSS 10.0.
A07 Auth Failures: weak passwords, no MFA, session fixation, credential stuffing.
A08 Data Integrity Failures: insecure deserialization, unsigned software updates.
A09 Logging & Monitoring Failures: no logs, insufficient detail.
A10 SSRF: server makes requests to internal services on attacker's behalf.
XSS: Reflected, Stored, DOM-based. Defense: CSP headers, output encoding.
CSRF: tricks authenticated users into unintended requests. Defense: CSRF tokens, SameSite cookies.
SQLi types: Classic/UNION-based, Blind Boolean, Time-based Blind, Error-based. Defense: prepared statements.
JWT vulns: alg:none attack, weak secret, no expiry, sensitive data in payload.

[OFFENSIVE SECURITY / PENTESTING]
Pentest phases: Recon→Scanning/Enumeration→Exploitation→Post-Exploitation→Reporting.
Pentest types: Black box (no info), White box (full info), Grey box (limited info).
OSINT tools: Google dorking, Shodan, Censys, TheHarvester, Maltego, WHOIS, Recon-ng.
Nmap key flags: -sS (SYN stealth), -sV (version detection), -O (OS detection), -A (aggressive), -p- (all ports).
Metasploit: exploits, payloads, auxiliaries, post. Meterpreter=in-memory advanced shell.
Post-exploitation: privilege escalation, lateral movement, persistence, exfiltration, pivoting.
Linux privesc: SUID binaries, sudo misconfigs, kernel exploits, weak cron jobs, PATH hijacking.
Windows privesc: unquoted service paths, weak registry ACLs, DLL hijacking, token impersonation, AlwaysInstallElevated.
Lateral movement: Pass-the-Hash, Pass-the-Ticket, RDP, WMI, PsExec, WinRM, SMB.
Social engineering: Phishing, Spear phishing, Whaling, Vishing, Smishing, Pretexting, Baiting.
Voice cloning 2026: 85% accuracy from 3 seconds of audio. Deepfakes indistinguishable from real.
ClickFix attacks: surged 517% in 2025. Trick users into pasting malicious PowerShell commands.

[SOC & DEFENSIVE OPERATIONS]
SOC tiers: T1 (alert triage)→T2 (deep investigation)→T3 (threat hunting, IR lead).
SIEM: aggregates+correlates logs. Products: Splunk, Microsoft Sentinel, IBM QRadar, Elastic Security.
Key Windows Event IDs: 4624 (logon success), 4625 (logon fail), 4688 (new process), 4720 (new user), 4732 (added to privileged group), 7045 (new service).
MITRE ATT&CK: 14 tactics from Recon to Impact. Kill Chain: Recon→Weaponize→Deliver→Exploit→Install→C2→Actions.
IoCs: IPs, domains, file hashes, URLs. IoAs: behavior patterns indicating active attack.
Pyramid of Pain: Hashes→IPs→Domains→Network Artifacts→Host Artifacts→TTPs (hardest to change).

[MALWARE & FORENSICS]
Malware types: Virus (self-replicates), Worm (spreads without host), Trojan (disguised), Ransomware (encrypts files), Rootkit (hides presence), Spyware, Adware, Keylogger, Fileless (lives in memory).
Static analysis: review code/strings without executing. Dynamic analysis: run in sandbox and observe behavior.
Forensics phases: Identification→Preservation→Collection→Examination→Analysis→Presentation.
Chain of custody: documented trail of evidence handling. Write blockers: prevent evidence modification.
Memory forensics: Volatility 3 for RAM analysis. Disk forensics: Autopsy, FTK.
WannaCry 2017: used EternalBlue (SMB exploit) + DoublePulsar backdoor. Affected 200k+ systems.
SolarWinds SUNSPOT: sophisticated supply chain attack; malware injected into build process.

[CLOUD SECURITY]
Shared responsibility model: provider secures cloud infrastructure; customer secures data, IAM, applications.
AWS key services: GuardDuty (threat detection), Security Hub (unified view), WAF (web app firewall), CloudTrail (audit logs), Macie (data classification), Inspector (vulnerability assessment).
IAM best practices: least privilege, MFA for all accounts, no root key usage, rotate access keys, use roles not users for services.
Cloud misconfigurations: #1 breach cause. Public S3 buckets, unrestricted security groups, default passwords, disabled logging.
Zero Trust in cloud: verify every request, micro-segment workloads, encrypt all data in transit and at rest.
CASB: Cloud Access Security Broker — visibility and control over cloud app usage.

[INCIDENT RESPONSE]
IR phases: Preparation→Identification→Containment→Eradication→Recovery→Lessons Learned (NIST framework).
PICERL: alternative acronym (Preparation, Identification, Containment, Eradication, Recovery, Lessons Learned).
Containment strategies: short-term (isolate), long-term (rebuild clean). Eradication: remove malware, patch, reset credentials.
Tabletop exercises: simulate incidents without real systems. Red team/Blue team exercises.
Runbooks: step-by-step IR procedures for specific attack types.

[GRC — GOVERNANCE, RISK, COMPLIANCE]
ISO 27001: international ISMS standard. Annex A: 93 controls. Requires risk assessment + statement of applicability.
NIST CSF 2.0: Govern, Identify, Protect, Detect, Respond, Recover.
PCI-DSS: payment card industry standard. 12 requirements. Applies to anyone handling card data.
NDPR (Nigeria Data Protection Regulation): Nigeria's data protection law. Enforced by NDPC. 72-hour breach notification. Data subject rights. Mandatory DPIA for large-scale processing.
NDPA 2023: Nigerian Data Protection Act — legislative backing for NDPR. Establishes NDPC as independent body.
Cybercrimes Act 2015 (Nigeria): criminalizes hacking, cyberstalking, identity theft. Penalties up to 7 years imprisonment.
CBN cybersecurity framework: applies to Nigerian financial institutions. Requires annual pen tests, CISO appointment, incident reporting within 24 hours.

[NIGERIAN CYBERSECURITY CONTEXT]
Common threats: SIM-swap fraud (telco insider access), account takeover via credential stuffing, BEC targeting C-suite, mobile money fraud (OTP interception via SS7), ransomware against SMEs.
Regulatory bodies: NDPC (data protection), CBN (fintech), NCC (telecoms), NITDA (general IT policy).
Key incidents: First Bank, GTB phishing campaigns; MTN SIM-swap incidents; NNPC supply chain risks.
Fintech security: Flutterwave, Paystack use AWS WAF + AWS Shield. CBN mandates pen tests for licensed fintechs. NDPR compliance for user data.
Oil & Gas OT risks: SCADA vulnerabilities in Niger Delta operations. Nation-state APT interest in energy infrastructure. Purdue model segmentation critical.
`;

export const RW_KB = `=== REAL-WORLD SECURITY ARCHITECTURE — DECISION FRAMEWORKS ===

[HOW TO THINK ABOUT A BUSINESS BEFORE RECOMMENDING ANYTHING]
Step 1 — Understand the business model: What does it do? How does it make money? What would a breach cost them?
Step 2 — Understand the data: Financial (PCI-DSS)? Health (HIPAA/NDPR)? Government (classified levels)? Data type defines compliance floor.
Step 3 — Understand the threat actors: Lagos fintech = organised cybercrime (account takeover). Oil company = nation-states. Startup = opportunistic bots.
Step 4 — Understand the scale: Users, TPS, uptime requirement (99.9% vs 99.999%)? Availability requirements drive architecture.
Step 5 — Understand the team and budget: A 3-person startup cannot run a 24/7 SOC. Match controls to realistic operations capability.

[DATABASE SELECTION — SECURITY IMPLICATIONS]
PostgreSQL: Best for financial data, ACID compliance. Row-level security built in. Perfect for: fintech, payment systems, healthcare, government records.
MongoDB: Flexible schema. Security risks: NoSQL injection if inputs not sanitised, easy to misconfigure for public access. Use only when data genuinely unstructured.
Redis: In-memory, fast. Use for sessions, caches, rate limiting. NEVER store sensitive persistent data. Session tokens in Redis = if compromised, all sessions gone.
S3/Blob: Files and documents. #1 cloud breach cause = public S3 buckets. Always block public access, enable versioning, encrypt with SSE-KMS.

[STACK SELECTION — NIGERIAN INDUSTRY CONTEXT]
Fintech/Payment (CBN + NDPR regulated):
- Backend: Node.js + Express or Python + FastAPI. PostgreSQL mandatory. Redis for sessions.
- Cloud: AWS (Flutterwave, Paystack use AWS). VPC with private subnets, no public-facing DB, WAF on API Gateway.
- Auth: OAuth2 + JWT (15min access token, 7-day refresh). MFA mandatory for admin. FIDO2 for high-value users.
- Compliance: NDPR data residency, CBN annual security assessment, PCI-DSS if handling card data directly.
- Threats: SIM-swap fraud, OTP interception via SS7, account takeover, insider threat from customer service staff.

Oil & Gas / Energy (Port Harcourt context):
- OT/IT separation is non-negotiable. Purdue Model: Level 0-2 (PLCs, SCADA, HMI) air-gapped from IT.
- SCADA protocols (Modbus, DNP3, OPC-UA) have no built-in authentication. Compensating controls: Claroty/Nozomi, network anomaly detection.
- IT Stack: Microsoft-heavy (Azure AD, Intune, Defender). SAP for ERP. Azure Sentinel for SIEM. CyberArk for PAM.
- Threats: APT groups (Sandworm, Lazarus target African energy). USB drop attacks common in oilfield offices.

SaaS Startup:
- Stack: React/Next.js + Node/Python backend + PostgreSQL on Supabase/RDS + Vercel/AWS.
- Priority: Auth first (Supabase Auth/Auth0 — never roll your own), input validation, HTTPS everywhere, dependency scanning.
- DevSecOps: GitHub Actions + Trivy (container scanning) + Dependabot + detect-secrets pre-commit hooks.

Government / Public Sector:
- Compliance: NITDA framework, NDPR/NDPA, Cybercrimes Act 2015. Data cannot leave Nigeria without DPA consent.
- Often Microsoft-heavy. Strong email security critical — government agencies are top BEC targets.

[INTERVIEW SCENARIOS — WHAT EMPLOYERS ACTUALLY ASK]
"We're building a new fintech app. How do you approach security?" → Ask: what data are you handling, what's your threat model, what are your compliance requirements? Then: threat model first, design security controls around data flows, implement defence in depth.
"What would you do on day one as our first security hire?" → Asset inventory, understand the existing stack, review access controls and IAM, check for exposed services (Shodan your own company), implement basic monitoring if none exists.
"How do you stay current with threats?" → Threat feeds (CISA, SANS, Nigerian CERT), CTF participation, bug bounty programs, security communities.

[PORTFOLIO PROJECTS THAT GET YOU HIRED IN NIGERIA]
1. SIEM Home Lab: Deploy Elastic Stack or Splunk Free, ingest logs, write detection rules for Nigerian threat patterns (SIM-swap, mobile money fraud).
2. Secure Fintech API: Build and document a CBN-compliant payment API on AWS with WAF, CloudTrail, JWT best practices, NDPR data handling.
3. OT Security Research: Virtualize a Modbus/DNP3 environment using OpenPLC and document an attack/defense scenario.
4. AI-Powered Threat Detection: Python script using ML to detect anomalies in log data.
5. Open Source Contribution: Security tool or write-up published on GitHub with Nigerian threat context.
`;

export interface Career {
  id: string;
  title: string;
  emoji: string;
  domains: string[];
  standOut: string;
  certs: string[];
  salaryNGN: string;
}

export const CAREERS: Career[] = [
  { id: 'soc', title: 'SOC Analyst', emoji: '🖥️', domains: ['Security Fundamentals', 'Networking', 'SOC & Defensive Ops', 'Malware & Forensics'], standOut: 'Build a Splunk/Elastic SIEM home lab and write custom detection rules for Nigerian threat patterns', certs: ['CompTIA Security+', 'CompTIA CySA+', 'Splunk Core Certified User'], salaryNGN: '₦180k–₦450k/mo' },
  { id: 'pentest', title: 'Penetration Tester', emoji: '⚔️', domains: ['Security Fundamentals', 'Networking', 'Offensive Security', 'Web App Security'], standOut: 'OSCP certification is gold. Document every CTF win. Build a home lab with Metasploitable and DVWA', certs: ['CompTIA PenTest+', 'OSCP', 'eJPT'], salaryNGN: '₦250k–₦600k/mo' },
  { id: 'cloud', title: 'Cloud Security Engineer', emoji: '☁️', domains: ['Security Fundamentals', 'Cloud Security', 'GRC & Compliance', 'Web App Security'], standOut: 'AWS Security Specialty cert + terraform IaC security project on GitHub is what Nigerian banks and fintechs look for', certs: ['AWS Security Specialty', 'Azure Security Engineer', 'CCSP'], salaryNGN: '₦300k–₦750k/mo' },
  { id: 'ir', title: 'Incident Responder', emoji: '🚨', domains: ['Security Fundamentals', 'Malware & Forensics', 'SOC & Defensive Ops', 'Networking'], standOut: 'Document real IR scenarios. Get familiar with Nigerian regulatory reporting requirements (CBN 24h, NDPC 72h)', certs: ['GCIH', 'CompTIA CySA+', 'GCFE'], salaryNGN: '₦200k–₦500k/mo' },
  { id: 'bugbounty', title: 'Bug Bounty Hunter', emoji: '🎯', domains: ['Web App Security', 'Offensive Security', 'Networking', 'Security Fundamentals'], standOut: 'HackerOne/Bugcrowd profile with public reports. Focus on Nigerian fintech apps — big attack surface, underreported', certs: ['OSCP', 'BSCP', 'eWPT'], salaryNGN: '₦100k–₦2M+/mo (variable)' },
  { id: 'grc', title: 'GRC Specialist', emoji: '📋', domains: ['GRC & Compliance', 'Security Fundamentals', 'Cloud Security', 'Networking'], standOut: 'NDPR/NDPA expertise is a genuine differentiator in Nigeria. Offer free NDPR gap assessment to SMEs as a portfolio piece', certs: ['CISM', 'CRISC', 'ISO 27001 Lead Implementer'], salaryNGN: '₦200k–₦500k/mo' },
  { id: 'malware', title: 'Malware Analyst', emoji: '🦠', domains: ['Malware & Forensics', 'Offensive Security', 'Security Fundamentals', 'SOC & Defensive Ops'], standOut: 'Publish malware analysis write-ups on GitHub. ANY.RUN, Cuckoo sandbox, IDA Pro — show you can reverse engineer', certs: ['GREM', 'GCFE', 'CompTIA Security+'], salaryNGN: '₦220k–₦550k/mo' },
  { id: 'forensics', title: 'Digital Forensics Investigator', emoji: '🔍', domains: ['Malware & Forensics', 'Networking', 'SOC & Defensive Ops', 'GRC & Compliance'], standOut: 'Understand Nigerian legal framework for digital evidence. Chain of custody documentation is critical in Nigerian court cases', certs: ['GCFE', 'GCFA', 'EnCE'], salaryNGN: '₦180k–₦450k/mo' },
  { id: 'devsecops', title: 'DevSecOps Engineer', emoji: '⚙️', domains: ['Web App Security', 'Cloud Security', 'Security Fundamentals', 'GRC & Compliance'], standOut: 'GitHub Actions pipeline with Trivy + OWASP ZAP + Dependabot + SBOMs. Nigerian startups desperately need this skill', certs: ['AWS DevOps Professional', 'Kubernetes Security', 'CSSLP'], salaryNGN: '₦280k–₦700k/mo' },
  { id: 'architect', title: 'Security Architect', emoji: '🏗️', domains: ['Security Fundamentals', 'Cloud Security', 'GRC & Compliance', 'Networking'], standOut: 'You need 5+ years first. But start building the mindset now — every design decision has a security implication', certs: ['CISSP', 'SABSA', 'TOGAF'], salaryNGN: '₦450k–₦1.2M/mo' },
  { id: 'ai-security', title: 'AI-Augmented Security Engineer', emoji: '🤖', domains: ['Security Fundamentals', 'Web App Security', 'SOC & Defensive Ops', 'AI-Augmented Security'], standOut: 'The most future-proof path in 2026. Companies are desperate for people who understand both traditional security and AI systems — extremely rare in Nigeria', certs: ['GAISP (in progress)', 'AWS AI Practitioner', 'CompTIA Security+'], salaryNGN: '₦350k–₦900k/mo + remote premium' },
];

export interface TopicItem {
  id: string;
  title: string;
  diff: number;
  thmUrl?: string;
  isAILiteracy?: boolean;  // marks topics loaded from ai_literacy_topics table
}

export interface Domain {
  name: string;
  topics: TopicItem[];
}

export const DOMAINS: Domain[] = [
  {
    name: 'Security Fundamentals',
    topics: [
      { id: 'security-fundamentals', title: 'Security Fundamentals', diff: 1, thmUrl: 'https://tryhackme.com/room/securityawareness' },
      { id: 'cia-triad', title: 'CIA Triad & AAA', diff: 1, thmUrl: 'https://tryhackme.com/room/principlesofsecurity' },
      { id: 'threat-modeling', title: 'Threat Modeling', diff: 2 },
      { id: 'risk-management', title: 'Risk Management', diff: 2 },
      { id: 'security-controls', title: 'Security Controls', diff: 2 },
    ],
  },
  {
    name: 'Networking',
    topics: [
      { id: 'networking', title: 'Networking Fundamentals', diff: 2, thmUrl: 'https://tryhackme.com/room/introtonetworking' },
      { id: 'network-protocols', title: 'Network Protocols', diff: 2, thmUrl: 'https://tryhackme.com/room/packetsframes' },
      { id: 'network-attacks', title: 'Network Attacks', diff: 3, thmUrl: 'https://tryhackme.com/room/networksecurityprotocols' },
      { id: 'firewalls-ids', title: 'Firewalls & IDS/IPS', diff: 2 },
    ],
  },
  {
    name: 'Cryptography',
    topics: [
      { id: 'cryptography', title: 'Cryptography Basics', diff: 2, thmUrl: 'https://tryhackme.com/room/encryptionscrypto101' },
      { id: 'pki-tls', title: 'PKI & TLS', diff: 3 },
      { id: 'post-quantum', title: 'Post-Quantum Crypto', diff: 4 },
      { id: 'password-security', title: 'Password Security & Hashing', diff: 2 },
    ],
  },
  {
    name: 'Web App Security',
    topics: [
      { id: 'owasp-top10', title: 'OWASP Top 10', diff: 2, thmUrl: 'https://tryhackme.com/room/owasptop10' },
      { id: 'sqli', title: 'SQL Injection', diff: 2, thmUrl: 'https://tryhackme.com/room/sqlinjectionlm' },
      { id: 'xss', title: 'XSS & CSRF', diff: 2, thmUrl: 'https://tryhackme.com/room/xssgi' },
      { id: 'api-security', title: 'API Security', diff: 3 },
      { id: 'web-auth', title: 'Web Authentication', diff: 3 },
    ],
  },
  {
    name: 'Offensive Security',
    topics: [
      { id: 'pentesting-intro', title: 'Pentesting Methodology', diff: 2, thmUrl: 'https://tryhackme.com/room/hackingwithourhacking' },
      { id: 'osint', title: 'OSINT & Recon', diff: 2, thmUrl: 'https://tryhackme.com/room/ohsint' },
      { id: 'exploitation', title: 'Exploitation Fundamentals', diff: 3, thmUrl: 'https://tryhackme.com/room/exploitingavulnerableweb' },
      { id: 'privesc', title: 'Privilege Escalation', diff: 3, thmUrl: 'https://tryhackme.com/room/linprivesc' },
      { id: 'post-exploitation', title: 'Post-Exploitation', diff: 4 },
    ],
  },
  {
    name: 'SOC & Defensive Ops',
    topics: [
      { id: 'soc-operations', title: 'SOC Operations', diff: 2, thmUrl: 'https://tryhackme.com/room/socc0re' },
      { id: 'siem', title: 'SIEM & Log Analysis', diff: 3, thmUrl: 'https://tryhackme.com/room/splunk101' },
      { id: 'mitre-attack', title: 'MITRE ATT&CK', diff: 3, thmUrl: 'https://tryhackme.com/room/mitre' },
      { id: 'threat-hunting', title: 'Threat Hunting', diff: 4 },
    ],
  },
  {
    name: 'Malware & Forensics',
    topics: [
      { id: 'malware-types', title: 'Malware Types', diff: 2, thmUrl: 'https://tryhackme.com/room/malmalintroductory' },
      { id: 'static-analysis', title: 'Static Analysis', diff: 3, thmUrl: 'https://tryhackme.com/room/malmalintroductory' },
      { id: 'digital-forensics', title: 'Digital Forensics', diff: 3, thmUrl: 'https://tryhackme.com/room/introductoryroomdfirmodule' },
      { id: 'memory-forensics', title: 'Memory Forensics', diff: 4 },
    ],
  },
  {
    name: 'Cloud Security',
    topics: [
      { id: 'cloud-fundamentals', title: 'Cloud Security Fundamentals', diff: 2, thmUrl: 'https://tryhackme.com/room/cloudsecurityintro' },
      { id: 'aws-security', title: 'AWS Security', diff: 3 },
      { id: 'iam', title: 'IAM & Access Control', diff: 3 },
      { id: 'cloud-threats', title: 'Cloud Misconfigurations & Threats', diff: 3 },
    ],
  },
  {
    name: 'GRC & Compliance',
    topics: [
      { id: 'grc-frameworks', title: 'GRC Frameworks', diff: 2 },
      { id: 'ndpr-ndpa', title: 'NDPR & NDPA (Nigeria)', diff: 2 },
      { id: 'iso27001', title: 'ISO 27001', diff: 3 },
      { id: 'cbn-compliance', title: 'CBN Cybersecurity Framework', diff: 3 },
    ],
  },
  {
    name: 'Incident Response',
    topics: [
      { id: 'ir-frameworks', title: 'IR Frameworks & Phases', diff: 2, thmUrl: 'https://tryhackme.com/room/becomingafirstresponder' },
      { id: 'containment', title: 'Containment & Eradication', diff: 3 },
      { id: 'ir-nigeria', title: 'IR in Nigerian Regulatory Context', diff: 3 },
    ],
  },
  {
    // AI Literacy topics are loaded dynamically from Supabase (ai_literacy_topics table)
    // based on the selected career path. These placeholder topics appear in the sidebar
    // until Supabase topics are loaded. The isAILiteracy flag tells TutorPage to use
    // the career-specific AI literacy KB when building system prompts.
    name: '🤖 AI-Augmented Security',
    topics: [
      { id: 'ai-tools-landscape', title: 'AI Tools for Your Career', diff: 2, isAILiteracy: true },
      { id: 'data-security-ai', title: 'Data Security When Using AI', diff: 2, isAILiteracy: true },
      { id: 'prompt-engineering', title: 'Prompt Engineering for Security', diff: 3, isAILiteracy: true },
      { id: 'verifying-ai-output', title: 'Verifying AI Security Output', diff: 3, isAILiteracy: true },
      { id: 'ai-powered-threats', title: 'AI-Powered Attacks', diff: 4, isAILiteracy: true },
      { id: 'ai-regulations', title: 'AI Regulations & Ethics', diff: 2, isAILiteracy: true },
    ],
  },
  {
    name: 'Real-World Architecture',
    topics: [
      { id: 'rw-fintech', title: 'Securing a Nigerian Fintech Stack', diff: 3 },
      { id: 'rw-oilandgas', title: 'OT/ICS Security (Oil & Gas)', diff: 4 },
      { id: 'rw-saas', title: 'Securing a SaaS Startup', diff: 3 },
      { id: 'rw-interview', title: 'Security Architecture Interviews', diff: 4 },
      { id: 'rw-portfolio', title: 'Building a Portfolio That Gets You Hired', diff: 2 },
      { id: 'rw-career', title: 'Career Path in Nigerian Cybersecurity', diff: 1 },
    ],
  },
];

export interface PlacementQuestion {
  q: string;
  opts: string[];
  a: number;
}

export const QBANK: PlacementQuestion[] = [
  { q: "What does the CIA in CIA Triad stand for?", opts: ["Control, Integrity, Authorization", "Confidentiality, Integrity, Availability", "Cryptography, Identity, Access", "Compliance, Integrity, Accountability"], a: 1 },
  { q: "Which of these is a symmetric encryption algorithm?", opts: ["RSA", "ECC", "AES", "Diffie-Hellman"], a: 2 },
  { q: "What port does HTTPS use?", opts: ["80", "443", "8080", "8443"], a: 1 },
  { q: "What is SQL injection?", opts: ["A hardware attack", "Inserting malicious SQL into input fields to manipulate databases", "A type of password attack", "Attacking SQL Server software directly"], a: 1 },
  { q: "What is the difference between IDS and IPS?", opts: ["IDS uses signatures, IPS uses anomalies", "IDS detects+alerts; IPS detects+blocks", "IDS for networks, IPS for endpoints", "IDS is commercial, IPS is open-source"], a: 1 },
  { q: "Which OWASP category covers IDOR and privilege escalation?", opts: ["Injection", "Broken Access Control", "Cryptographic Failures", "Insecure Design"], a: 1 },
  { q: "What does 'defense in depth' mean?", opts: ["Using one strongest control", "Multiple layers of security controls", "Defending only the perimeter", "Focusing all resources on critical assets"], a: 1 },
  { q: "What is the purpose of hashing passwords?", opts: ["Hashing is faster than encryption", "If stolen, original passwords cannot easily be recovered", "Hashed passwords are easier to store", "Hashing uses less space"], a: 1 },
  { q: "What is a SOC Tier 1 analyst's primary role?", opts: ["Write security policies", "Conduct penetration tests", "Perform threat hunting", "Triage incoming alerts and initial investigation"], a: 3 },
  { q: "What regulation governs data protection in Nigeria?", opts: ["GDPR", "HIPAA", "NDPR/NDPA", "PCI-DSS"], a: 2 },
  { q: "What is OSINT?", opts: ["A hacking tool", "Open Source Intelligence gathering", "An OS security framework", "A type of malware"], a: 1 },
  { q: "What is the TCP three-way handshake?", opts: ["SYN→ACK→FIN", "ACK→SYN→SYN-ACK", "DATA→ACK→CLOSE", "SYN→SYN-ACK→ACK"], a: 3 },
  { q: "What is credential stuffing?", opts: ["Storing many passwords in one file", "Using stolen credentials from one breach to access other services", "Brute forcing one account", "Phishing for credentials"], a: 1 },
  { q: "Which of these is NOT a phase of the NIST Incident Response process?", opts: ["Preparation", "Identification", "Monetization", "Recovery"], a: 2 },
  { q: "What is a honeypot?", opts: ["A reward for catching attackers", "Encryption-resistant malware", "A trap system to lure and study attackers", "Secure credential storage"], a: 2 },
];

export function shuffleArr<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}

export function prepQuestions() {
  return shuffleArr(QBANK).slice(0, 10).map(q => {
    const opts = q.opts.map((text, i) => ({ text, correct: i === q.a }));
    const shuffled = shuffleArr(opts);
    return { q: q.q, opts: shuffled.map(o => o.text), a: shuffled.findIndex(o => o.correct) };
  });
}
