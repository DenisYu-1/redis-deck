# 08: Console integration

**What to build:** On the Console, the chat offers "+ Current line"; the toolbar gains **Ask about this line** and each result gains **Ask about result**. A line chip sends the line text; a result chip sends the result text, masked with the hidden fields. Each code block in an answer gains **Open in console** (adds it to the current tab) and, when the question came from a line chip, **Replace line N in <tab>**.

**Blocked by:** 07, and the Console page (`.scratch/console/SPEC.md`, not yet ticketed or built)

**Status:** done

- [x] Both Ask buttons open the chat with the right chip
- [x] Result text is masked before it reaches any model, and respects AI access "See values"
- [x] Open in console and Replace line change the right tab and line, and never run anything
- [x] The assistant gets no command tool
- [x] Tests for result masking and the code block actions
