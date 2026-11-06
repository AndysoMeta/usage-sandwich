# Usage sandwich

A Claude Code mod that shows how much of your Claude plan is left as a sandwich. The more of your limit you use, the more bites get taken out of it, and when the limit is used up only crumbs are left. Under the sandwich is a graph of how much of your 5-hour session and weekly limits you've used over the last day or week.

What it shows:
- The sandwich, bitten for whichever limit (5-hour session or weekly) is closest to running out
- How much is left on each limit and when it resets
- What the current Claude Code session has cost
- A step graph of usage, with Day and Week views
- A status line entry, and a heads-up at 75%, 90% and 100% used

Chats, projects, Claude Code and Claude Duet all draw from the same plan limits, so the sandwich covers all of them. It can't split usage by product, because Claude doesn't report that split.

Limit numbers arrive with Claude's replies in Claude Code, so the sandwich updates while a Claude Code session is open. It only appears on a Pro or Max plan, where Claude reports usage limits.

Open it with `/sandwich`. It also opens by itself when a session starts.

## Install

In Claude desktop: click + next to the prompt box, then Plugins, then Add marketplace with `AndySoMeta/usage-sandwich`, then Add plugin.

At the prompt of a Claude Code terminal session:

```
/plugin install usage-sandwich --marketplace AndySoMeta/usage-sandwich
```

From a shell:

```
claude plugin install usage-sandwich --marketplace AndySoMeta/usage-sandwich
```
