# Novel Console

Novel Console is a Mac app for reading your own EPUB novels with the help of AI.
It reads each book once, then gives you a reader that marks the characters, places and story threads as you go.
You can also open views for each book's characters, places and threads.

Your books stay on your Mac.
The app only adds a small hidden `.novel` folder next to them.

## What you need

- **A Mac with Apple Silicon** (M1 or later). Intel Macs are not supported.
- **Two API keys**, used when a book is read:
  - **Jev**, from TypeSafe AI.
  - **A work model**, from DeepSeek.
- **Optional:** an AI agent such as [Claude Code](https://claude.com/claude-code), Codex or Pi, if you want one to work with your library (see [Use it from your own agent](#use-it-from-your-own-agent)).

## Download and install

1. Go to the **[latest release](https://github.com/gardianofthedarkness/novel-console/releases/latest)**.
   Download the file named `Novel-Console-…-arm64.dmg`.
2. Open the DMG and drag **Novel Console** onto the **Applications** folder.
3. Eject the DMG.

### Opening it the first time

The app isn't signed with an Apple developer certificate yet, so macOS blocks it the first time you open it.
You only have to allow it once:

1. Open **Novel Console** from Applications.
   macOS says it can't be opened. Click **Done**.
2. Open **System Settings → Privacy & Security**.
   Scroll down to the Security section.
3. Next to the message about Novel Console, click **Open Anyway**.
   Confirm, then enter your Mac password.

From then on it opens normally.

If you're comfortable with Terminal, this one command does the same thing:

```sh
xattr -dr com.apple.quarantine "/Applications/Novel Console.app"
```

## Getting started

1. **Add your keys.**
   Click **Keys** in the top bar.
   Paste your Jev key and your work-model key, then click **Save**.
   The dots next to Keys turn on when each key is set.
   Keys are kept only on this Mac, readable only by you, and never shown again.
2. **Add a folder of books.**
   Click **Add a folder…** and choose a folder with your EPUBs.
   Plain-text books (`.txt` or `.md`) can be brought in with **Import a text file…** in the Library.
3. **Read a book.**
   In the Library, click **▶** next to a book.
   The app shows the cost before you start.
   It's about $0.35 for a 125,000-character volume and takes a couple of minutes.
   Reading happens in the background, and you can stop it at any time.
4. **Open it in the Reader.**
   Once a book has been read, open it in the **Reader**.
   Names, places, who is speaking and notes are marked in the text.

## Finding your way around

The icons down the left side open the different views:

| View | What it shows |
| --- | --- |
| **Library** | Your folders and their books |
| **Outline** | The open book's chapters and scenes |
| **Search** | Words and names in the open book |
| **Characters** | The people in the book, and the path each one takes |
| **Places** | Where things happen, what lies inside what, and who was there |
| **Strands** | Who travels together, where they part, and where they meet again |
| **Record** | One character or place, with every line that mentions them |
| **Problems** | Spots where the reading wasn't sure who said or did something |
| **Reader** | The book itself, with its marks |
| **Readings** | Each book's reading, and your keys |

Other things you can do:

- **Arrange.**
  In the Library, **Arrange all** sorts the series it finds by title into universes, each in volume order.
  It's free and uses no AI.
  Fix anything it missed by hand, or ask an agent (below).
- **Day and night.**
  Click **◐** to switch between light and dark.

## Use it from your own agent

Novel Console comes with a `novel` command and a skill, so an AI agent you already use can work with your library.
This works with Claude Code, Codex or Pi.
Your agent stays signed in its own way, and the app never sees its login.

1. Open the chat panel with **⌘I** and click **Set up your agent**.
   This installs the `novel` command as `~/.local/bin/novel`.
   It also adds the `novel-folder` skill to each of those agents it finds on your Mac.
2. Start a new session of your agent and ask it things like:
   - "Arrange the novels in ~/Books into universes and reading order."
   - "In ~/Books, who is Ana and where is she first named?"
3. Watch the result appear in Novel Console as the agent works.

The chat panel also lists your agents' recent sessions.
From the Library you can ask Claude Code or Pi to arrange a folder for you.

> **Agents cost tokens.** An agent reads the books' openings and runs many commands to decide.
> That uses your agent's own plan or API credit, which can add up on a big folder.
> **Arrange all** is free, so try it first.

The skill is also attached to each [release](https://github.com/gardianofthedarkness/novel-console/releases/latest) as `novel-folder-skill-….zip`, for an agent the app doesn't detect.
Put the `novel-folder` folder in that agent's skills folder.
The `novel` command still comes from the app.

## Your privacy

- Your books are never uploaded anywhere by this app, and nothing about them is published.
- The only thing written into your book folder is a hidden `.novel` folder holding the reading results.
- While a book is being read, its text is sent to the two model services (TypeSafe and DeepSeek) using your keys.
  Nothing is sent at any other time.
- You pay those services directly for what a reading uses.

## Help

Something not working? [Open an issue](https://github.com/gardianofthedarkness/novel-console/issues).

---

## For developers

The app is an Electron shell around a backend it does not hold itself:

- **[novel-ontology-pi](https://github.com/gardianofthedarkness/novel-ontology-pi)**: the world engine (terrain, places,
  the director) and the server the app talks to. How it works is in its
  [design document](https://github.com/gardianofthedarkness/novel-ontology-pi/blob/main/docs/v3/design.html).
- **[story-graph](https://github.com/gardianofthedarkness/story-graph)**: the reading, the cast across volumes and the
  characters, a package of that backend.

Check out novel-ontology-pi and story-graph beside this repository (or set `NOVEL_CONSOLE_BACKEND` to the
novel-ontology-pi folder), build story-graph and then novel-ontology-pi (`npm install`, `npm run build` in each), then here:

```sh
npm install
npm start          # the app on that backend
npm run dmg        # macOS (Apple Silicon): the backend assembled into build/backend, the .app and a DMG
npm run exe        # Windows x64: the same, then an NSIS installer
node test/drive.mjs <folder>[,<folder>…] [--app <packaged app>] [--shots <dir>]
```

`npm run backend -- --engine <dir>` assembles the backend from another checkout. This repository was split from
novel-ontology-pi (`apps/novel-console`) on 2026-11-21 with its history.
