# Security Policy for @nmi-agro/rvo-connector

The `@nmi-agro/rvo-connector` project takes the security of its code and its users very seriously. We appreciate your efforts to responsibly disclose any security vulnerabilities you may find.

## How to Report a Vulnerability

We encourage you to report any potential security vulnerabilities to us as quickly as possible.

**Please use GitHub's private vulnerability reporting feature:**

1. Navigate to the project's **Security** tab on GitHub.
2. Click on **"Report a privately disclosed vulnerability"**.
3. Fill out the form with the details of the vulnerability.

This creates a private channel where we can discuss and fix the issue securely.

## Safe Harbor

We believe in responsible disclosure and that security researchers should be recognized for their efforts. We will not pursue legal action against individuals who discover and report security vulnerabilities in accordance with this policy. We ask that you:

* Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services.
* Perform all testing only on in-scope systems.
* Refrain from publicly disclosing the vulnerability until it has been patched and publicly announced by the project maintainers.

## What to Include in a Report

To help us quickly understand and address the issue, please include as much of the following information as possible:

* **A clear and concise description** of the vulnerability.
* **Steps to reproduce** the vulnerability, including any necessary code snippets, configuration, or environment details.
* **The expected behavior** and **the actual behavior** observed.
* **Impact:** Explain how the vulnerability could be exploited and its potential impact on users or the system.
* **Any known workarounds** or suggested fixes (if applicable).
* **Your GitHub username** (optional, but helpful for communication).

## Scope of this Policy

This policy applies to security vulnerabilities found within the `@nmi-agro/rvo-connector` codebase. This primarily includes:

* Authentication bypasses within the library's handling of ABA or TVS flows.
* Injection vulnerabilities (e.g., XML injection, header injection) in the SOAP request generation.
* Sensitive data leakage through logging or error handling within the library.
* Deserialization vulnerabilities during XML parsing (if applicable).

**Out of Scope:**

* General RVO webservice vulnerabilities (these should be reported to RVO).
* Issues related to RVO account management, certificate issuance, or RVO's network policies.
* Vulnerabilities in third-party libraries not directly related to `rvo-connector`'s implementation, unless they are critical and exploited through our code.

## Our Commitment and Response

Upon receiving a vulnerability report:

1. **Acknowledgement:** We will acknowledge receipt of your report within **3 business days**.
2. **Investigation:** We will investigate the reported vulnerability to confirm its validity and assess its impact.
3. **Communication:** We will keep you informed of our progress and any questions we may have.
4. **Resolution:** Once the vulnerability is confirmed and addressed, we will coordinate a disclosure timeline with you (if you wish to be credited). We aim to provide a fix in a timely manner.

Please do not disclose the vulnerability publicly until it has been patched and publicly announced by the project maintainers.

Thank you for helping to keep `@nmi-agro/rvo-connector` secure!
