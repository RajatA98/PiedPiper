# Cover Letter — Staff / Senior Software Engineer, Product (NYC) at Suno

*Draft. Edit to your voice. The structure below is what hiring managers at founding-team-shaped startups read for; the substance is what makes PiedPiper land.*

---

Hi —

I'm Rajat Arora. I'm applying for the Staff / Senior Software Engineer, Product role in NYC.

The short version: I built a working creator-feedback layer for AI-generated music as a portfolio piece, and I'd like to build the production version of it inside Suno. The link is at the bottom of this letter; everything below is what it demonstrates and what I'd want to do next.

**The project**: PiedPiper takes a Suno (or Udio) generation, encodes it with a music-tuned audio embedder, retrieves the top-3 closest reference tracks from a curated catalog, and surfaces a calibrated similarity report — percentile rank, audio previews, album art, a specificity score showing whether the generation is broadly similar to many tracks or distinctively close to one. It ships with a measured leave-one-out retrieval eval (R@1=0.394 / R@3=0.494 / MRR=0.458, p50 latency 0.28 ms), a written ADR explaining one architectural decision I had to make about embedding anisotropy, and a deployment story on $0 infrastructure (FastAPI on Hugging Face Spaces, React on Vercel, GitHub Actions for CI, UptimeRobot for keepalive).

The full demo is at **https://piedpiper-xi.vercel.app**. The source is at **https://github.com/RajatA98/PiedPiper**. The decision record explaining how I calibrated the scoring is at **[ADR-0001](https://github.com/RajatA98/PiedPiper/blob/main/docs/decisions/0001-similarity-calibration.md)**.

**The product opportunity it points at**: every Suno generation could be passed through a similarity check before the creator hears it, and the result could be used to give actionable feedback in the generation flow — *"this scored close to existing track X; here are three prompt tweaks to push it toward more originality."* That makes originality a first-class product surface, not a legal afterthought. It's also a piece of UI that creators would genuinely use, because they want their tracks to feel distinctive. Building that loop inside Suno — the API contract, the UI affordance, the way it lands in the existing generation experience — is the kind of cross-stack product work I'm best at.

**Why I think I fit the role specifically**:

- I ship end-to-end. PiedPiper is FastAPI on the backend, React + Vite on the frontend, deployed on free-tier infrastructure with auto-deploys wired through GitHub Actions, an HF Space restart loop driven by Python from the same repo, and a Vercel project linked via `vercel git connect`. Nothing was outsourced.
- I iterate on real signal. When I first put a real Suno track through the deployed system, all three matches read as "100% similar." I diagnosed the cause (embedding anisotropy — contrastive-trained encoders collapse music into a narrow cone), researched the calibration literature, and shipped a presentation-layer fix that exposes both raw and calibrated metrics. That's documented in ADR-0001 in the repo.
- I have product instinct without pretending to be a model researcher. The fine-tune path for a custom encoder is a real next step, but I scoped it out and chose calibration first because it preserved the existing eval and shipped faster. That's a product engineer's judgment, not a researcher's.
- I document decisions. The repo has an ADR for the calibration choice, a `PROJECT_OVERVIEW.md` for the system as a whole, a `DEPLOY` section in the README walking through the full setup, and inline comments only where they explain *why* — not *what*.

**What I'd want to do at Suno**:

- Build the production version of the creator-feedback loop described above — first as an internal originality check, then as a creator-facing surface in the generation flow.
- Own the cross-stack delivery: the encoder service, the retrieval API, the UI affordance, the eval harness that makes the threshold decisions auditable.
- Work alongside research engineers on what the right encoder is to deploy (custom fine-tune on Suno-internal generation/source pairs is the obvious move, and I have a concrete recipe in mind).
- Push toward the metric-driven discipline that small teams sometimes skip — every feature has a measurable outcome we can revisit.

I'm based in NYC. Available for a conversation any time this week or next. If the demo crashes or the cold-start delay annoys you, the keepalive ping should keep it warm, but let me know and I'll spin it up immediately.

Thank you for reading.

Best,
Rajat Arora
rajat1998@gmail.com
https://github.com/RajatA98
https://piedpiper-xi.vercel.app

---

*A small note on the name: in the Silicon Valley pilot, Richard Hendricks first pitches Pied Piper as a music app — a tool to search whether your melody resembles anything that's come before. The investors laugh him out of the room and the show pivots to compression. PiedPiper-the-portfolio-piece is Richard's original pitch, ten years later, applied to AI-generated music. The engineering is straight; the framing is a wink.*

---

## Editing notes for you

Things to consider customizing:
- **Open**: Some hiring managers find "Hi —" too casual for senior roles. "Dear Suno Engineering Team" is the safer choice if you want a corporate flavor; "Hi —" is right if you want to signal "founding-team energy."
- **Length**: this is ~600 words. Some application portals truncate at 1500 chars or 300 words. If Ashby has a length limit, the version that survives a trim is: paragraphs 1, 2, 3, 4, and the closing. Drop the bullet list under "Why I fit" if needed.
- **Tone**: I leaned slightly product/PM (e.g., "originality is a first-class product surface"). If you want it more eng-flavored, lead the project description with the architecture mermaid and the LOO eval numbers instead of the product framing.
- **Specific names**: I didn't reference Mikey Shulman or any specific Suno engineer because cold-applying-by-name often reads as opportunistic. If you have a warm intro contact, lead the letter with their name in the second sentence: *"[Person] suggested I apply directly while their introduction makes its way through."*
- **Demo URL caveat**: the cold-start line ("If the demo crashes...") is honest and shows you understand the infra constraints. Some people would cut it; my read is leaving it in signals operational awareness, which is what a founding product engineer needs.
- **Edit the bullet list under "Why I think I fit"** to your voice — that's the most-tuned section and should sound like you, not like me.
