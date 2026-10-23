# Lantern

A gentle website for well-being. People discover who they are through simple questions, share their thoughts (privately or with everyone), talk with an AI companion, and feel a little less alone.

"Lantern" is a working name.

## What's in it

| Area | What it does |
| --- | --- |
| **Home** | A "How are you feeling?" check-in that suggests a next step for each mood |
| **Discover** (`#discover`) | Ten questions that build a portrait: main threads, strengths, a reminder, ways to connect, and a constellation picture. Retakes are kept so people can see how they change |
| **Talk** (`#companion`) | An AI companion (Claude). It says clearly that it is an AI and not a therapist, and encourages real-world connection. Without an API key it runs in a clearly labelled offline mode with pre-written reflection prompts |
| **Thoughts** (`#thoughts`) | Write a thought and keep it private (on the device) or share it anonymously. Others can reply, tap "I relate" or report it. Authors can delete their own posts |
| **Create** (`#create`) | Creative writing prompts, saved to private notes |
| **Breathe** (`#breathe`) | A one-minute guided breathing exercise |
| **Get help now** (`#help`) | Always in the header. Emergency guidance and helplines by country |
| **Privacy** (`#privacy`) | Explains what is stored where. Download or delete everything |

### Safety

- Crisis language (suicide, self-harm) is detected in chats and posts, and a "you're not alone" card links to helplines. In chat, the AI is also told to check on the person's safety.
- Shared posts are hidden automatically after 3 reports.
- Rate limits on posting and chatting, length limits on everything, and all user text is rendered as plain text.

### Privacy

- Portraits, private notes, mood check-ins and chat history stay in the browser's `localStorage`.
- The server stores only shared thoughts and comments. There are no accounts or emails.
- Each shared post returns a secret delete key that only the author's browser keeps; the server stores just a hash of it.
- Chat messages are sent to Anthropic's API to generate replies and are not stored by the server.

## Run it

Requires Node 18+.

```sh
cd lantern
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, everything works except that the companion runs in offline mode.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `LANTERN_DATA` | `lantern/data/lantern.json` | Where shared thoughts are saved |
| `ANTHROPIC_API_KEY` | (none) | Turns on the AI companion |
| `LANTERN_AI=on` | (off) | Turns the companion on when the SDK finds credentials another way (for example an `ant auth login` profile) |

The companion uses `claude-opus-5-5` at low effort, with server-side refusal fallbacks enabled.

## Tests

From the repository root:

```sh
npm test                           # everything
node --test tests/lantern.test.js  # just Lantern
```

## Files

| File | Purpose |
| --- | --- |
| `public/core.js` | Questions, portrait logic, crisis detection and validation (shared by browser and server) |
| `public/app.js` | The single-page UI |
| `public/index.html`, `public/styles.css` | Layout and styles (light and dark mode, phone first) |
| `store.js` | Shared thoughts and comments, saved to a JSON file |
| `server.js` | Static files, the thoughts API and the companion endpoint |

## Before a real public launch

This is a working first version. Before opening it to the public:

- **Database.** Move from the JSON file to a real database (for example Postgres or SQLite) and add backups.
- **Moderation.** Add human review of reported posts, and possibly automatic screening of posts before they appear.
- **Hosting.** Use HTTPS, and put the server behind a proxy so rate limits see real client addresses.
- **Legal.** Write terms of use and a privacy policy, and set an age policy (18+ is the simplest start).
- **Review.** Have the safety wording and helpline list checked by a mental-health professional, and localise helplines.
- **Costs.** AI replies cost money per message, so plan a budget, caps or funding.
