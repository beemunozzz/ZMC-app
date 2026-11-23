# Design skills used on ZMC Hub

Claude Code loads these automatically when working in this project.

| Skills | From | License | What they do |
|---|---|---|---|
| emil-design-eng, animate, improve-animations, review-animations, animation-performance, animation-vocabulary, find-animation-opportunities, choreograph, gestures, remove-animations, apple-design, learn-taste, break-ui, ask-emil | [emilkowalski/skill](https://github.com/emilkowalski/skill) @ 64eb3de | MIT | Motion and design-engineering guidance (Emil Kowalski) |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) @ b49177d | Apache 2.0 | Design direction, critique, audit, polish, typography, color, layout |

**Deliberately left out (safety):**
- Impeccable's `scripts/` folder (a launcher that downloads and runs a separate program), its `.claude/settings.json` hooks (which run that program automatically after every edit), and its helper agents. Impeccable's own instructions support working without the launcher: it reads its reference files directly.
- Emil's iPhone-only skills (write-swift, animate-expo, mobile-native) and library pickers (pick-ui-library, ask-sonner, prototype).
- [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill): built for marketing landing pages and runs Node scripts automatically. Revisit when redesigning zmcmove.com.

To update: copy the newer markdown files from the same repositories, re-check them for scripts or hooks, and update the versions above.

ZMC's own brand and taste rules (the `zmc-app-design` skill and `CLAUDE.md` section 8) come first; these skills add craft on top.
