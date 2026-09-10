import type { Metadata } from "next";
import { loadCorpus } from "../../corpus/load.mjs";
import * as seoOnpage from "../../corpus/seo-onpage.mjs";

export const metadata: Metadata = {
  title: "The rulebook, published in full",
  description:
    "Every rule Proof checks a website against, with the case where each one is wrong. Published so a finding can be argued with rather than taken on trust.",
};

/**
 * The corpus, published.
 *
 * THIS PAGE IS THE PRODUCT'S CREDIBILITY, and publishing it is a decision taken
 * rather than a default. The argument for it: a check a client cannot audit is a
 * check they should not act on, and the false-positive note is the field that
 * makes a finding arguable. The argument against, which is real: a published
 * rulebook teaches anyone to reproduce it.
 *
 * The trade was made the way the sibling detector makes it, and the split is
 * written down in docs/MCP-DELIVERY.md. Deterministic rules publish in full,
 * because their value IS that a stranger can check them. Advisory playbooks stay
 * private, because they are judgement rather than measurement and nothing about
 * them is verifiable by a reader anyway.
 *
 * The rules are read from the SAME module the checks run from, at build time. So
 * this page cannot drift from what actually runs: there is no second copy to go
 * stale, which is the defect a hand-maintained "our rules" page always becomes.
 */
export default function Rulebook() {
  const corpus = loadCorpus(seoOnpage);
  const families = [...new Set(corpus.rules.map((r) => r.family))];

  return (
    <main id="top">
      <section className="rb" data-tone="light">
        <div className="wrap">
          <p className="label acc">The rulebook</p>
          <h1 style={{ marginTop: "1rem", maxWidth: "24ch" }}>
            Every rule, and where each one is wrong.
          </h1>
          <p className="lede" style={{ marginTop: "1.2rem", maxWidth: "64ch" }}>
            This is the whole list your site gets checked against, published because a check you
            cannot argue with is a check you should not act on. Every rule carries the case where it
            gives the wrong answer, written down before you ask. Nothing here predicts a search
            ranking. Each rule states a property of the page and nothing more.
          </p>

          <dl className="rb-meta">
            <div>
              <dt>Rulebook</dt>
              <dd>{corpus.id}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{corpus.version}</dd>
            </div>
            <div>
              <dt>Rules</dt>
              <dd>{corpus.rules.length}</dd>
            </div>
            <div>
              <dt>Families</dt>
              <dd>{families.length}</dd>
            </div>
          </dl>

          <p className="rb-note">
            A version number that did not move while the rules did would make every past receipt a
            lie, so it moves in the same change as the rules. This page is generated from the same
            file the checks run from, so it cannot describe rules that are not the ones running.
          </p>

          <ol className="rb-list">
            {corpus.rules.map((rule) => (
              <li key={rule.id} id={rule.id}>
                <div className="rb-head">
                  <code>{rule.id}</code>
                  <span className={`rb-sev rb-${rule.severity}`}>{rule.severity}</span>
                  <span className="rb-fam">{rule.family}</span>
                  <span className="rb-w">weight {rule.weight}</span>
                </div>
                <h2>{rule.title}</h2>
                <p className="rb-why">{rule.rationale}</p>
                <p className="rb-fix">
                  <b>How to avoid it</b> {rule.prevention}
                </p>
                <p className="rb-fp">
                  <b>When this rule is wrong</b> {rule.falsePositiveNote}
                </p>
              </li>
            ))}
          </ol>

          <div className="rb-cant">
            <h2>What this rulebook cannot see</h2>
            <p>
              Published because a gap you know about is worth more than a number you cannot check.
            </p>
            <ul>
              <li>
                <b>Anything needing an outside request.</b> Whether a link resolves, what a
                competitor ranks for, whether a domain is about to lapse. These checks make no
                network requests at all, which is also why nothing about your business leaves your
                site to run them. Those questions belong to other departments and they ask
                permission first.
              </li>
              <li>
                <b>Anything about search results.</b> No rule here claims a ranking effect, because
                nobody can substantiate one. A rule states a property of the page: the title is this
                long, this image has no alt attribute.
              </li>
              <li>
                <b>Whether the writing is any good.</b> That is a judgement, it is done by a person
                reading it, and it is not on this list because it is not a measurement.
              </li>
              <li>
                <b>Anything rendered after the page settles.</b> The check reads the page once it has
                loaded. Content that appears later, after a click or a delay, is not seen, and when
                too little of a page can be read the check says so and withholds the result rather
                than reporting a clean one.
              </li>
            </ul>
          </div>

          <p className="rb-back">
            <a href="/">Back to Proof</a>
          </p>
        </div>
      </section>
    </main>
  );
}
