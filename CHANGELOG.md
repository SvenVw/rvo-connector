# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
