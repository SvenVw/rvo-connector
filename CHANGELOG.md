# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UNRELEASED]

### Added

- CI Workflow: Added GitHub Actions for automated unit testing and type checking on every push and pull request.

### Security

- Fixed XML Injection vulnerability in SOAP request builder by escaping user inputs.
- Masked access token logging in `examples/request-bedrijfspercelen-tvs.ts` to prevent sensitive information leakage.

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
