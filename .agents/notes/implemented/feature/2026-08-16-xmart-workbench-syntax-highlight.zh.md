# Agent Note：X-Mart 工作台语法高亮

Status: implemented

[English](2026-08-16-xmart-workbench-syntax-highlight.md) | 中文

## 问题

工作台 Monaco 只按最后一个扩展名选语言，再用 Monaco 自带分词。`build.gradle`、`.prettierignore`、`.npmrc`、`.prettierrc`、`gradle.properties`，以及 `Dockerfile` / `gradlew` 这类没有扩展名的文件都会变成 plaintext，Tab 图标对了，正文仍是一片白字。

## 决策

**先认文件名，再走 Shiki。** `languageFromPath` 先精确匹配 basename（以及 `.env*`），再从长到短试扩展名。编辑器接上与 `ui-editor` 相同的 Shiki JS-regex 管线（`one-dark-pro` / `min-light`），静态带上 Groovy、properties、ini、docker、dotenv、makefile。Shiki 4 没有 ignore 包，ignore 文件用一小段 Monarch（`#` 注释、`!` / 通配符）。Shiki 没加载的语言（Rust、C 等）继续用 Monaco 内置 id，避免注册一个空语言把原高亮盖掉。

## 考虑过的替代

**Gradle 当成 Java，ignore 继续 plaintext。** 否决：Java 分词不会给 `buildscript` / `repositories` 上色，ignore 文件还是一片白。

**按需 `import()` 额外 Shiki 语言。** 否决：这个包关掉了 client code splitting，模块加载器解析不了旁边的 chunk。

## 后果

打开 `build.gradle` 走 Groovy；`.prettierignore` 会标注释和通配符；`.npmrc` / `gradle.properties` / `.prettierrc` / `.env.local` 分别走 ini / properties / json / dotenv。需要重启桌面窗口才能吃到新的 client 包。`conversation.view` 和 `agent-loop` 不动。
