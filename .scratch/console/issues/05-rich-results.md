# 05: Rich results

**What to build:** The client renders each plain reply by its shape. A small client-side table says which commands return pairs and which return Key names.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Pairs show as two columns (HGETALL, ZRANGE WITHSCORES, CONFIG GET)
- [ ] SCAN shows the Key list and a Continue from cursor N button, which runs the next SCAN
- [ ] KEYS, SCAN and RANDOMKEY Key names are links that open the Key on the Keys page
- [ ] Bulk values and table cells are decoded as JSON or PHP the same way the Keys page does it
- [ ] Tables show at most 500 rows, with "showing 500"
- [ ] A table result has Copy JSON
- [ ] Route tests for the reply shapes: scalar, array, pairs, SCAN
- [ ] Client test for rendering results by shape
