# Wiki Lint Report — 2026-05-04

Scanned 32 pages.

## Structural Issues

No structural issues found.

## Graph-Aware Issues

### Hub Pages with Insufficient Content (0 pages)
No hub stubs detected — all high-degree nodes have sufficient content.

### Fragile Bridges (0 community pairs)
No fragile bridges — all community connections have redundant links.

### Isolated Communities (0 communities)
No isolated communities — all clusters have external connections.

---

Here is the lint report for the provided LLM Wiki pages.

---

## Lint Report

### Contradictions

1.  **HermesAgent Star Count vs. Trend**
    - **Pages involved:** `entities\HermesAgent.md` vs. `entities\HermesJSEngine.md`
    - **Claim:** `HermesAgent.md` claims the project has **128,747** stars. `HermesJSEngine.md` (a much older, well-known Meta project) claims only **11,017** stars.
    - **Analysis:** This is likely a data entry error or test value. While possible, it is highly improbable for a niche AI agent framework to have 10x the stars of Meta's default JavaScript engine for React Native (which is used by millions of developers). This number should be verified against the actual GitHub repository.

2.  **Definition of AI Agent Capabilities (Memory)**
    - **Pages involved:** `concepts\AIAgent.md` vs. `concepts\SelfImprovingAI.md`
    - **Claim:** `AIAgent.md` states "**长期记忆**：跨会话持久化存储" (Long-term memory: cross-session persistent storage). `SelfImprovingAI.md` describes "Cross-session memory" as a key mechanism that includes "FTS5 full-text search" and "LLM summary compression".
    - **Analysis:** These are not contradictory but the `AIAgent.md` definition is overly simplistic. It implies memory is merely storage, while `SelfImprovingAI.md` reveals it involves complex retrieval and compression systems. `AIAgent.md` needs to be updated to reflect a more nuanced definition that includes retrieval and forgetting mechanics.

3.  **Status of Ilya Sutskever at OpenAI**
    - **Pages involved:** `entities\GregBrockman.md` vs. `entities\IlyaSutskever.md`
    - **Claim:** `GregBrockman.md` implies he is currently "former CTO" and lists Ilya as a current co-founder. `IlyaSutskever.md` correctly states he "left OpenAI in 2024."
    - **Analysis:** `GregBrockman.md` is factually correct about Greg but implies a current connection to Ilya at OpenAI without noting his departure. This is a contradiction by omission, as the reader might assume both are still at the company. `IlyaSutskever.md` is the authoritative and more recent source on this matter.

---

### Stale Content

1.  **Last Updated Dates on Core Architecture Pages**
    - **Pages involved:** `concepts\AttentionMechanism.md` (last_updated: 2024-02-28), `concepts\Transformer.md` (last_updated: 2024-03-15)
    - **Analysis:** While the fundamental theories are correct, these pages are over two years old. The context is stale. They fail to mention subsequent architectural innovations that challenge or extend the Transformer (e.g., Mamba/State Space Models, Mixture-of-Experts, multi-query/grouped-query attention which are now standard). The `Transformer.md` page links to `StateSpaceModels.md` but provides no comparative analysis. The `LLaMA.md` page mentions future directions like MoE but the Transformer page does not.

2.  **Google as a Monolithic Entity**
    - **Pages involved:** `entities\Google.md` (last_updated: 2024-02-10)
    - **Claim:** The page lists "Google Research," "DeepMind," and "Google Brain" as key teams, stating "Google Brain (merged into DeepMind)."
    - **Analysis:** This information is stale. The "Google Brain" team has been fully merged into Google DeepMind. The description of "Google Research" and "DeepMind" as separate entities is outdated. The page now serves as a historic record but does not reflect the current organizational structure of Google's AI efforts.

3.  **Source Citation for ChatGPT**
    - **Pages involved:** `entities\ChatGPT.md`
    - **Claim:** The page lists its sources as "OpenAI official documentation, common knowledge, personal experience."
    - **Analysis:** The inclusion of "common knowledge, personal experience" is a critical wiki quality failure. This is not a valid, verifiable source. The page needs to be rewritten with citations to specific papers (e.g., the GPT-4 technical report) or official blog posts.

---

### Data Gaps & Suggested Sources

1.  **Security & Isolation for AI Agents**
    - **Pages involved:** `concepts\AIAgent.md`
    - **Gap:** The page mentions "Security & Isolation" (sandboxing, permission boundaries, HITL) but provides no implementation details. A developer reading this has no idea *how* to achieve this.
    - **Suggested Sources:**
        - **Anthropic's "Agent Cookbook"**: Contains patterns for tool use, including error handling and permission verification.
        - **OWASP Top 10 for LLM Applications**: Provides a standard taxonomy of security risks (e.g., LLM01: Prompt Injection, LLM06: Sensitive Information Disclosure) that directly apply to agent security.
        - **Research paper:** "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (Zheng et al., 2023) – covers evaluation, which implicitly involves safety guardrails.

2.  **Comparative Data on Agent Frameworks**
    - **Pages involved:** `concepts\AgentFrameworkComparison.md`
    - **Gap:** The page starts to compare Hermes, LangChain, and AutoGen but is truncated. The reader is left without a conclusion on which to use for what purpose. There are no performance benchmarks, latency comparisons, or cost analyses.
    - **Suggested Sources:**
        - **Berkeley Function Calling Leaderboard (BFCL)**: Measures the ability of LLMs to call functions/tools, which is a core component of agent frameworks.
        - **LangSmith / LangFuse**: Public dashboards comparing latency and cost across different chains/agents.
        - **GitHub Issue Tracker Activity**: To gauge ecosystem health and community responsiveness beyond stars.

3.  **Practical Evaluation of State Space Models**
    - **Pages involved:** `concepts\StateSpaceModels.md`
    - **Gap:** The page explains the theory of Mamba well but lacks a critical assessment. The "limitation" noted (poor performance on "copying" tasks) is a major weakness. The page does not mention the Hydra architecture or how Mamba-2 improved upon it.
    - **Suggested Sources:**
        - **Mamba-2 paper** by Gu & Dao (2024).
        - **The "Hourglass" benchmark** for long-context retrieval.
        - **Jamba (AI21 Labs)** : A hybrid architecture that combines Mamba layers with attention layers, representing a real-world compromise.

---

### Concepts Needing More Depth

1.  **Reward Hacking (in SelfImprovingAI.md)**
    - **Pages involved:** `concepts\SelfImprovingAI.md`
    - **Issue:** The concept is mentioned but not explained. The page says "Reward Hacking in Skill Creation" is a risk, but never defines *what* reward hacking is or gives a concrete example. (e.g., "An agent rewarded for 'summarizing accurately' might learn to output only the first sentence of a document, as that is statistically the most likely answer, rather than performing true summarization.")
    - **Recommendation:** Add a sub-section with a clear definition and an example of reward hacking in an RLHF or self-improvement context.

2.  **Constitutional AI (CAI)**
    - **Pages involved:** `concepts\AIAlignment.md`
    - **Issue:** The page describes CAI's process but stops abruptly. It does not discuss the **Limitations of CAI** (e.g., the model can learn to "gaming" the constitution, the ethical complexity of writing a constitution, or how to handle conflicts between constitutional principles).
    - **Recommendation:** Complete the section with limitations, a comparison to RLHF (e.g., RLHF is better for preference learning, CAI is better for rule-following), and mention tools like Constitutional AI via Llama Guard.

3.  **"Chain-of-Thought" and "Test-Time Compute"**
    - **Pages involved:** `entities\LargeLanguageModels.md`
    - **Issue:** These are mentioned as "Emergent vs. Deliberately Trained Capabilities" but are not defined. "Test-Time Compute" is a critical shift in methodology. The page needs to explain what it means for a model to spend more compute at inference (e.g., "The model generates multiple reasoning traces, then selects the most consistent or self-verified one").
    - **Recommendation:** Create a dedicated sub-page or significantly expand this section, citing the "Chain-of-Thought Prompting Elicits Reasoning..." paper and the "Scaling LLM Test-Time Compute Optimally..." paper (DeepMind, 2024).