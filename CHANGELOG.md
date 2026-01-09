# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-09

### Added

- CI Workflow: Added GitHub Actions for automated unit testing and type checking on every push and pull request
- Timeout Support: Added `requestTimeoutMs` configuration to `RvoClientConfig` to prevent indefinite hanging on network requests (defaults to 30 seconds). This applies to both OAuth 2.0 token exchange and SOAP service calls.
- Code Quality: Integrated SonarCloud for automated code analysis, security scanning, and test coverage reporting.

### Security

- **[BREAKING CHANGE]** Removed implicit file reading for `pkioPrivateKey` to prevent potential LFI and file existence oracle vulnerabilities. The key must now be provided as a string. Users previously passing a file path must now read the file content themselves before passing it to the config.
- Fixed XML Injection vulnerability in SOAP request builder by escaping user inputs.
- Removed access token logging in `examples/request-bedrijfspercelen-tvs.ts` to prevent sensitive information leakage.

## [1.0.1] - 2026-01-05

### Security

- Patch for CVE-2025-15284

## [1.0.0] - 2025-12-16

### Added

- First stable release
- Security policy
- Contribution guidelines
- Code of Conduct

### Security

- Patch for CVE-2025-65945

## [0.1.0] - 2025-12-01

### Added

- Initial release of `@nmi-agro/rvo-connector`.
- Basic client for RVO EDI-Crop webservices with ABA and TVS (eHerkenning) authentication.
- Support for `OpvragenBedrijfspercelen` service.
- Conversion of `OpvragenBedrijfspercelen` response to GeoJSON (WGS84) with GML parsing and coordinate transformation.
- Validation for PKIO Private Key format.
- Example scripts for ABA and TVS authentication.
- Detailed TSDoc documentation for public API.
- GitHub Actions workflow for npm package publishing on release.
- Comprehensive unit tests for GML to GeoJSON transformation and core client functionality.
