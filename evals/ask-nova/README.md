# Ask Nova eval

An eval for `POST /api/ask`, the on-site assistant in this repo. It runs the real route handler in-process (pricing gate, query rewrite, retrieval, generation) over 37 cases and grades every answer.

## Baseline

`claude-sonnet-5` answering, `claude-opus-5-5` judging, 37 cases × 2 reps, measured cost **$1.11** per full pass.

| Metric | Rate | What it checks |
|---|---|---|
| **Pass** | **65%** (48/74) | every applicable check below passed |
| Right route | 92% (68/74) | the request took the expected path: retrieval, pricing hand-off, or canned page summary |
| No price | 97% (72/74) | the answer states no price or discount figure |
| Right doc found | 100% (42/42) | every expected document was among the passages the model saw |
| Right card | 85% (44/52) | the UI shows the contact-sales card when the docs can't answer, and the CTA when they can |
| Grounded | 79% (41/52) | judge: no claim about Northline beyond the retrieved passages |
| Right behaviour | 100% (52/52) | judge: answers when the docs cover it, says so when they don't, corrects a false premise |

By group: pricing 12/12, follow-ups 6/6, adversarial 2/2, answerable 20/30, multi-doc 3/4, summaries 2/4, out-of-scope 3/10, pricing traps 0/6.

## What it found

1. **The confidence gate fails both ways.** It reads the top rerank score, which measures topical similarity, not whether the docs answer the question. Unanswerable questions about Jira, HIPAA and uptime show the "Get started" CTA under an "I don't have that information" answer; "Can we keep our data in the EU?" is answered correctly but shows the contact-sales card.
2. **The pricing gate blocks legitimate questions.** "How should we *plan* the first week…", "our *payment* operations team" and "update *monthly* or in real time" are routed to sales every time.
3. **Nova misstates how Nova starts.** Asked when it begins learning, it says "as soon as ticket data accumulates"; the docs say it activates after 30 days of history.
4. **The 404 page summary quotes a price** ("$29/seat/mo"), against the rule that the assistant never gives pricing.

Grounded is slightly pessimistic: of its 11 failures, 2 are judge errors (a link lead-in read as a claim, and a defensible reading of which plans include webhooks) and 3 are borderline inferences.

## Run it

Needs `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in an env file.

```bash
npm run eval -- --variant baseline --reps 2
```

Results land in `baseline/results.jsonl`; failed attempts (API errors, timeouts) go to `baseline/errors.jsonl` and are retried on the next run instead of being scored. Transcripts (`baseline/traces/`) and the HTML report are generated locally and not committed.

## Design notes

- **Real entry point.** The runner imports `src/app/api/ask/route.ts` and calls `POST` with a constructed `Request`. Setting `RAG_EVAL_TRACE=1` makes the final `meta` event also carry the route, passages, model, usage and stop reason; it is off in production and the UI ignores it.
- **Free checks first.** Route, price and retrieval checks are programmatic. The judge only runs when the answer went through retrieval and generation.
- **The judge has no fallback model**, on purpose: a refusal rerouted to another model would change who is grading mid-run, so it surfaces as an error instead.
- **Harness gate.** The runner refuses to run if the runner, grader, cases or route code changed since a human last approved them with `--approve-harness`.
- **Ground truth** in `cases.json` was drafted from `docs/` and reviewed by hand; it was never generated from the model under test.
