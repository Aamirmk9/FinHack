#!/usr/bin/env python3
"""Generate presentation speaking scripts for ShadowTrace FinHack 2026."""

from fpdf import FPDF

class ScriptPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "ShadowTrace  |  FinHack 2026 Speaking Script", align="C", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def section_title(self, title):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(20, 20, 80)
        self.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def speaker_name(self, name):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(40, 40, 40)
        self.cell(0, 10, f"Speaker: {name}", new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def time_note(self, time):
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(120, 120, 120)
        self.cell(0, 7, f"Target time: ~{time}", new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def stage_direction(self, text):
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 160)
        self.multi_cell(0, 5, f"[{text}]")
        self.ln(2)

    def body_text(self, text):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        self.cell(6, 6, "-")
        self.multi_cell(0, 6, text)
        self.ln(1)

    def sub_heading(self, text):
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(50, 50, 100)
        self.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def transition_note(self, text):
        self.set_font("Helvetica", "BI", 10)
        self.set_text_color(160, 80, 40)
        self.multi_cell(0, 6, f">> TRANSITION: {text}")
        self.ln(3)


pdf = ScriptPDF()
pdf.set_auto_page_break(auto=True, margin=20)

# ============================================================
# SECTION 1: AAMIR  -- OVERVIEW
# ============================================================
pdf.add_page()
pdf.section_title("Part 1: Overview & Problem Statement")
pdf.speaker_name("Aamir")
pdf.time_note("1 min 15 sec")

pdf.stage_direction("Open on the Dashboard screen showing live stats and risk distribution.")

pdf.body_text(
    "Good afternoon everyone. We're Team ShadowTrace, and today we're presenting an AI-powered system "
    "designed to detect and investigate money laundering networks on the blockchain."
)

pdf.sub_heading("The Problem")
pdf.body_text(
    "Every year, an estimated two to five trillion dollars is laundered globally. Criminals are increasingly "
    "using cryptocurrency and autonomous AI agents to move illicit funds through complex, multi-hop transaction "
    "chains that traditional rule-based systems simply cannot keep up with. Current compliance tools either "
    "generate massive false-positive rates, or they miss sophisticated patterns entirely."
)

pdf.sub_heading("Our Solution")
pdf.body_text(
    "ShadowTrace is a full-stack detection platform that combines graph analytics, machine learning, and "
    "rule-based heuristics into a single hybrid detection engine. Instead of choosing between explainability "
    "and accuracy, we get both."
)

pdf.bullet("We analyze over 50,000 transactions across 3,000+ wallets in real time.")
pdf.bullet("Our hybrid model achieves a 98.3% F1 score  -- that means high precision with minimal false positives.")
pdf.bullet(
    "For comparison, a rule-based-only approach scores just 3.5% F1, and a pure ML model, while accurate, "
    "lacks the explainability that regulators require."
)
pdf.bullet(
    "Every detection is classified under FinCEN typologies  -- layering, structuring, round-tripping, rapid relay, "
    "and fan-out collection  -- so investigators know exactly what pattern they're looking at."
)

pdf.stage_direction("Point to the model comparison chart on the Dashboard.")

pdf.body_text(
    "As you can see on the dashboard, we display the precision, recall, and F1 scores for all three approaches "
    "side by side, along with real-time risk distribution and a live alert feed. This gives analysts an "
    "immediate, at-a-glance view of network health."
)

pdf.transition_note("Hand off to Zayd for the Investigation deep-dive.")

# ============================================================
# SECTION 2: ZAYD  -- INVESTIGATION
# ============================================================
pdf.add_page()
pdf.section_title("Part 2: Investigation Panel")
pdf.speaker_name("Zayd")
pdf.time_note("1 min 15 sec")

pdf.stage_direction("Switch to the Investigation Panel screen. Have a high-risk cluster selected.")

pdf.body_text(
    "Thanks Aamir. So once our system flags a suspicious cluster, the next question is: what do investigators "
    "actually do with that information? That's where the Investigation Panel comes in."
)

pdf.sub_heading("Cluster Deep-Dive")
pdf.body_text(
    "On the left, you can see a ranked list of flagged clusters sorted by risk score. When I click into one, "
    "the panel populates with everything an analyst needs."
)

pdf.bullet(
    "A wallet risk breakdown  -- a bar chart showing the top wallets in the cluster and their individual scores."
)
pdf.bullet(
    "The complete transaction history  -- every internal transfer with timestamps, amounts, and the specific "
    "pattern that was flagged, whether that's layering, structuring, or rapid relay."
)
pdf.bullet(
    "An explainability panel that shows the FinCEN typology classification with a confidence percentage. "
    "This is critical  -- regulators don't accept black-box outputs. They need to understand why something was flagged."
)

pdf.sub_heading("Freeze Priority & Threat Matching")
pdf.body_text(
    "We also calculate a freeze priority score from zero to one hundred, factoring in velocity, recency, "
    "volume, and severity. This tells the compliance team which clusters need immediate attention versus "
    "which can wait for the next review cycle."
)

pdf.bullet(
    "We cross-reference cluster behavior against known threat actor profiles. Right now we're matching against "
    "51 FBI-published Lazarus Group Ethereum addresses from the Bybit hack. The system calculates a behavioral "
    "similarity score so analysts can see if a cluster is acting like a known state-sponsored actor."
)

pdf.sub_heading("SAR Generation")
pdf.body_text(
    "Finally, with one click, investigators can generate a Suspicious Activity Report narrative. We integrate "
    "with the Claude API to produce a detailed, human-readable SAR, or fall back to a structured template. "
    "This cuts report-writing time from hours to seconds."
)

pdf.transition_note("Hand off to Mustafa for the Timeline Analysis.")

# ============================================================
# SECTION 3: MUSTAFA  -- TIMELINE ANALYSIS
# ============================================================
pdf.add_page()
pdf.section_title("Part 3: Timeline Analysis")
pdf.speaker_name("Mustafa")
pdf.time_note("1 min 15 sec")

pdf.stage_direction("Switch to the Timeline view. Load a suspicious cluster and prepare to hit Play.")

pdf.body_text(
    "Thanks Zayd. So we've seen how to identify and investigate a cluster  -- now let me show you how we "
    "reconstruct the story of how the money actually moved."
)

pdf.sub_heading("Animated Fund Flow Playback")
pdf.body_text(
    "The Timeline view lets us replay a cluster's entire transaction history step by step. When I hit play, "
    "you'll see each transaction animate in chronological order. The cumulative volume chart on the right "
    "builds up in real time, so you can see exactly when the bulk of the funds moved."
)

pdf.stage_direction("Hit Play and let a few transactions animate through.")

pdf.bullet(
    "Each transaction is labeled with its pattern type  -- so you can watch a layering sequence unfold, "
    "see structuring transactions cluster just below the ten-thousand-dollar threshold, or catch a rapid "
    "relay chain moving funds through eight-plus hops in under an hour."
)
pdf.bullet(
    "The scrubber gives full manual control. Investigators can pause at any point, step forward or backward, "
    "and examine individual transactions in the log table below."
)
pdf.bullet(
    "The transaction log highlights the currently active transaction and shows sender, receiver, amount, "
    "and pattern type  -- all in real time as the playback progresses."
)

pdf.sub_heading("Why This Matters")
pdf.body_text(
    "Traditional compliance tools give you a list of flagged transactions. But money laundering is a process  -- "
    "it happens over time. By visualizing the temporal sequence, analysts can see the operational tempo of the "
    "laundering network. A rapid burst of transactions in a short window tells a very different story than "
    "slow, periodic transfers spread over weeks. This temporal context is what turns a list of alerts into "
    "an actionable investigation."
)

pdf.transition_note("Hand off to Hassan for the Global Network view.")

# ============================================================
# SECTION 4: HASSAN  -- GLOBAL NETWORK
# ============================================================
pdf.add_page()
pdf.section_title("Part 4: Global Network Visualization")
pdf.speaker_name("Hassan")
pdf.time_note("1 min 15 sec")

pdf.stage_direction("Switch to the Globe Network view. Slowly rotate to show city nodes and arcs.")

pdf.body_text(
    "Thanks Mustafa. Everything we've shown so far  -- the detection, investigation, and timeline  -- feeds into "
    "this global network view, which maps the geographic footprint of suspicious activity."
)

pdf.sub_heading("3D Globe Visualization")
pdf.body_text(
    "What you're looking at is a real-time 3D globe with wallet nodes positioned across 24 major financial "
    "centers worldwide. Each node is color-coded by risk  -- green for low, yellow for medium, orange and red "
    "for high and critical risk. The arcs connecting cities represent transaction flows between wallets in "
    "different geographic regions."
)

pdf.bullet(
    "Node size scales with transaction volume  -- larger nodes mean more funds flowing through that location."
)
pdf.bullet(
    "You can click on any node to inspect wallet details: its risk score, flagged patterns, transaction count, "
    "and community membership."
)
pdf.bullet(
    "The risk slider lets analysts filter by minimum risk score, so they can zoom in on just the high-risk "
    "activity and cut through the noise."
)

pdf.sub_heading("The Big Picture")
pdf.body_text(
    "This view is designed for strategic-level analysis. When you see concentrated arcs between specific "
    "cities  -- say, a heavy flow corridor between two regions  -- that tells you where to focus cross-border "
    "cooperation and where to deploy additional monitoring. It turns abstract transaction data into a "
    "geographic intelligence map."
)

pdf.sub_heading("Closing")
pdf.body_text(
    "To wrap up  -- ShadowTrace is a complete end-to-end platform. From real-time detection with a 98.3% F1 "
    "score, to explainable investigation panels with FinCEN-classified typologies, to temporal playback that "
    "reconstructs the laundering story, to this global view that maps the threat landscape. We built this "
    "to give financial intelligence units the tools they need to stay ahead of increasingly sophisticated "
    "laundering networks. Thank you."
)

pdf.stage_direction("Open for Q&A.")

# Save
output_path = "/home/mustafa/src/finhack/FinHack/ShadowTrace_Speaking_Scripts.pdf"
pdf.output(output_path)
print(f"PDF saved to {output_path}")
