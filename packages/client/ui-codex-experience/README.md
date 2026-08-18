# @deepseek-ai/dsh-client-ui-codex-experience

English | [中文](README.zh.md)

Registers the `codex` Tool timeline presentation. It owns only the compact visual frame around the standard logged Tool call tree. It does not change model requests, tools, session events, or the default DSH presentation.

Any preset may opt in through `experienceProfile: codex`; a preset with no declared profile continues to use the unchanged Tool renderer. Other experiences register their own profile ids without modifying this package or `ui-tool`.
