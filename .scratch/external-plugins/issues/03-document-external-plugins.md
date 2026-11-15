# 03: Document External Plugins

**What to build:** A user reading the docs knows how to add an **External Plugin** in Docker and in the **Desktop app**, and what the trust implications are. See `.scratch/external-plugins/SPEC.md` and ADR 0003.

**Blocked by:** 01, 02

**Status:** done

- [x] README has an "External plugins" section: folder name, manifest and handler layout, restart required
- [x] Desktop app data folder path is given for macOS and Linux
- [x] Docker note explains the `./data` bind mount
- [x] Warning that handlers are arbitrary JS run by the backend, and the data folder must not be shared with untrusted users
- [x] The existing plugins README points to the External Plugin option
- [x] Wording uses the GLOSSARY terms Plugin, External Plugin, Workflow, Desktop app
