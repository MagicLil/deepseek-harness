# Agent Note: X-Mart workbench syntax highlighting

Status: implemented

English | [中文](2026-08-16-xmart-workbench-syntax-highlight.zh.md)

## Problem

The workbench Monaco host picked a language from the last file extension only, and then used Monaco's built-in tokenizer. `build.gradle`, `.prettierignore`, `.npmrc`, `.prettierrc`, `gradle.properties`, and extension-less names such as `Dockerfile` / `gradlew` all became plaintext, so the buffer looked unhighlighted even when the tab icon was correct.

## Decision

**Name-aware language ids, then Shiki.** `languageFromPath` now matches an exact basename (and `.env*`) before the longest extension. The editor boots the same Shiki JS-regex pipeline as `ui-editor` (`one-dark-pro` / `min-light`) with a static grammar set that includes Groovy, properties, ini, docker, dotenv, and makefile. Ignore files have no Shiki pack in v4, so they get a small Monarch grammar (`#` comments, `!` / glob operators). Languages Shiki does not load (Rust, C, …) stay on Monaco's built-in ids so we do not register an empty override.

## Alternatives considered

**Map Gradle to Java and ignore files to plaintext.** Rejected: Java tokens do not color `buildscript` / `repositories`, and ignore files would stay flat.

**Lazy `import()` of extra Shiki langs.** Rejected: this package disables client code splitting because the module loader cannot resolve sibling chunks.

## Consequences

Opening `build.gradle` uses Groovy tokens; `.prettierignore` colors comments and globs; `.npmrc` / `gradle.properties` / `.prettierrc` / `.env.local` pick ini / properties / json / dotenv. Restart the desktop window to load the new client bundle. `conversation.view` and `agent-loop` stay untouched.
