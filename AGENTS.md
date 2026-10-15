# Repository Guidelines

## Project Structure & Module Organization

`maple-path` currently contains only Git metadata; no application, assets, or tests have been added. When introducing the first implementation, document its structure in `README.md`. Suggested directories are `src/` for application code, `public/` for static assets, `tests/` for automated checks, and `docs/` for design notes and verification evidence. Adopt these paths only when they suit the chosen stack.

## Build, Test, and Development Commands

No build, development, or test commands are configured yet. Add reproducible commands alongside the initial implementation and describe their prerequisites in `README.md`.

- For Node.js projects, use `pnpm` for dependency management and scripts. Define scripts before documenting commands such as `pnpm dev`, `pnpm build`, or `pnpm test`.
- For Python tooling, use `uv` instead of invoking `pip` directly.
- For Haskell, use GHC installed through GHCup and Cabal for dependencies, builds, tests, and the REPL.

Commit the dependency lockfile produced by the selected toolchain.

## Coding Style & Naming Conventions

Establish formatter and lint configuration with the first source files. Until then, use two-space indentation for Markdown lists and JSON, descriptive names, and consistent formatting within each language. Prefer lowercase, hyphen-separated documentation filenames, such as `scene-design.md`. Keep modules focused and place related code together.

## Testing Guidelines

No testing framework or coverage threshold exists. Choose checks appropriate to the implementation and document how to run them. Name tests after the behavior they verify, following the selected framework’s conventions. For visual or interactive changes, record browser coverage and include screenshots when useful. State which checks actually ran and any remaining gaps.

## Commit & Pull Request Guidelines

There is no commit history from which to infer conventions. Use concise, imperative messages with a conventional prefix, for example `feat: add initial scene` or `docs: describe local setup`. Keep each commit focused on one coherent change.

Pull requests should explain the problem, resulting behavior, and validation performed. Link relevant issues and attach screenshots for visible changes. Keep credentials and generated build output out of version control.
