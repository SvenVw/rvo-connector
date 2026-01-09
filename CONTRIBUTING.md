# Contributing to @nmi-agro/rvo-connector

Thank you for your interest in contributing to `@nmi-agro/rvo-connector`! I ([SvenVw](https://github.com/SvenVw)) started this project to have a modern and easy to use interface to the RVO webservices as I was struggling with the documentation. As I thought others could benefit from this package as well, we at [NMI](https://nmi-agro.nl) decided to make it open-source. Hopefully we can together build and maintain a robust and well-typed TypeScript package that makes it easy and reliable to communicate with the RVO webservices. Your contributions will be highly appreciated!

To help you get started and understand our development process, here are some guidelines.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher.
- **pnpm**: This project uses [pnpm](https://pnpm.io/) for package management.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/SvenVw/rvo-connector.git
   cd rvo-connector
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

## 🛠️ Development Workflow

This project uses a modern toolchain to ensure code quality and performance.

### Key Commands

- **Build**: `pnpm build` (Uses `tsdown` to bundle the library).
- **Develop**: `pnpm dev` (Watch mode for continuous rebuilding).
- **Type Check**: `pnpm typecheck` (Runs `tsc` to verify types without emitting files).
- **Lint**: `pnpm lint` (Uses `oxlint`).
- **Format**: `pnpm format` (Uses `oxfmt`).
- **Test**: `pnpm test` (Uses `vitest`).
- **Docs**: `pnpm docs` (Generates TypeDoc documentation).

### Linting & Formatting

This project uses [Oxlint](https://oxc-project.github.io/docs/guide/usage/linter.html) and [Oxfmt](https://github.com/oxc-project/oxc) for fast and efficient linting and formatting. We appreciate it if your code adheres to these checks before submitting a PR. We recommend running the following before submitting a PR:

```bash
pnpm lint:fix
pnpm format
```

## 🏗️ Architecture & Coding Standards

### 1. Naming Conventions (Important)

To ensure consistency with the official RVO documentation, we kindly ask that you follow the Dutch naming conventions used by RVO for service methods and key parameters. This helps in easily comparing our implementation with their official specifications.

- **Service Methods:** Use the exact RVO operation name.
  - ✅ `client.opvragenBedrijfspercelen(...)`
  - ❌ `client.getCropFields(...)`
- **Parameters:** Where possible, use the parameter names as defined in the RVO documentation and XML/XSD examples.
- **Internal Logic:** You may use English for internal variables, helper functions, and comments to maintain general code readability, but the public API surface should mirror RVO.

### 2. TypeScript & Typing

This package aims to be **fully typed**.

- **Strive for strong typing:** Aim to avoid `any` wherever possible.
- **Acceptable `any` usage:**
  - **Dynamic/complex XML structures:** When parsing XML with `xml2js` (or similar libraries) into TypeScript objects, some intermediate structures or highly nested, variable parts might be challenging to fully type strictly. In such cases, a carefully scoped `any` might be used, but always with a comment explaining why and what is expected.
  - **Error handling:** For `catch (error: any)` blocks, if the exact type of error cannot be narrowed down or is highly varied across different external APIs, using `any` might be acceptable.
- Use interfaces/types for all SOAP request and response structures.
- Ensure all public methods have explicit return types.

### 3. Documentation

This project uses **TypeDoc** to generate API documentation.

- We kindly request that all public classes, methods, and interfaces include TSDoc/JSDoc comments.
- Include `@param` and `@returns` tags.
- If a method maps to a specific RVO service, please reference that service in the comments.

```typescript
/**
 * Retrieves the registered crop fields for a specific farm.
 * Maps to the RVO service: OpvragenBedrijfspercelen.
 *
 * @param params - The search parameters.
 * @returns A promise resolving to the GeoJSON feature collection.
 */
```

## 🧪 Testing Strategy

Testing interactions with RVO services is challenging for open-source contributors because:

1. **Authentication:** Requires specific eHerkenning certificates (PKIoverheid).
2. **Network:** RVO restricts access to allowlisted IP addresses.

**How to write tests:**

### 1. Unit Tests (Preferred)

Focus on testing logic that _does not_ require a network connection.

- **Transformers:** Test that XML responses are correctly parsed into TypeScript objects/GeoJSON. Use mock XML strings as input.
- **Builders:** Test that your code generates the correct SOAP XML structure.

### 2. Mocked Client Tests

Use `vitest` to mock the `fetch` function.

- Verify that your client sends the correct headers (Auth, SOAPAction).
- Verify that the body contains the expected XML structure.
- Mock the server response to ensure your client handles success/error states correctly.

**Note:** If you do not have access to the RVO webservices, please don't feel obligated to run "Integration" tests. If you develop a feature that would benefit from integration testing with real RVO services, please make a note in your Pull Request, and a maintainer will ensure these tests are performed. Your focus on unit and mocked tests is highly appreciated!

## 📝 Pull Request Process

1. Create a feature branch from `main`.
2. Implement your changes.
3. Add unit tests to cover your code.
4. Please run `pnpm lint` and `pnpm typecheck` to help ensure there are no errors.
5. Submit a Pull Request with a clear description of the changes.

### Developer Certificate of Origin (DCO)

We require that contributors sign off on their commits, which is a common practice in many open-source projects. This certifies that you've created your contribution in whole or in part yourself, or that you have the right to submit it under the project's license.

To sign off on a commit, simply add a `Signed-off-by` line at the end of your commit message. If you're committing via the command line, you can do this by adding the `-s` flag to your `git commit` command:

```bash
git commit -s -m "Your commit message here"
```

Your sign-off will look something like this: `Signed-off-by: Your Name <your.email@example.com>`.

**Privacy Tip:** If you want to keep your email private, you can use your GitHub-provided `noreply` email address (e.g., `id+username@users.noreply.github.com`) in your git config and sign-off.

If you forget to sign off, you can amend your last commit:

```bash
git commit --amend --no-edit -s
```

For web-based commits on GitHub, the platform will automatically prompt you to sign off.

## 🙏 Getting Help and Providing Feedback

### Important Note on RVO Specifics

Please understand that this project is a client library for interacting with existing RVO webservices. We are unable to provide support for:

- **RVO account creation or management.**
- **Obtaining eHerkenning or PKIoverheid certificates.**
- **RVO specific policies, data structures, or business rules.**

For these types of questions, please contact RVO directly through their official support channels.

### Reporting Bugs

Encountered an issue with the library? Detailed bug reports are appreciated!

1. **Check existing issues:** Before opening a new issue, please check if a similar bug has already been reported.
2. **Open a new issue:** If not, open a new issue on our [GitHub Issue Tracker](https://github.com/SvenVw/rvo-connector/issues).
3. **Provide details:** Include a clear and concise description of the bug, steps to reproduce it, expected behavior, and actual behavior. Screenshots, code snippets, and environment details (Node.js version, OS) are very helpful.

### Suggesting Features

Have an idea for a new feature or improvement? Feature suggestions are highly valued!

1. **Check existing discussions/issues:** See if your idea has already been discussed.
2. **Open a new feature request:** You can open a feature request on our [GitHub Issue Tracker](https://github.com/SvenVw/rvo-connector/issues).
3. **Explain your idea:** Describe the feature, why you think it's valuable, and how it would be used.

### Discussions

For general questions, architectural discussions, or broader topics related to the project, please use [GitHub Discussions](https://github.com/SvenVw/rvo-connector/discussions).
