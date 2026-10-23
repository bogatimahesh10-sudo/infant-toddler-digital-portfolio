// Lantern core: the question bank, portrait building, mood suggestions, crisis-language
// detection and input validation. Pure functions only, shared by the browser and the server.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LanternCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Each answer adds weight to one or more "threads". A portrait is the strongest threads.
  const THREADS = {
    reflective: {
      name: "The Reflector",
      line: "You live richly on the inside. You notice what others miss and need quiet to hear yourself think.",
      strengths: ["Deep thinking", "Self-awareness", "Noticing small things"],
      care: "Protect some unhurried time each day. Your quiet is not loneliness; it is how you refill.",
      connect: "One-to-one conversations suit you more than crowds. Invite one person for a slow walk.",
    },
    connector: {
      name: "The Connector",
      line: "People light you up. You bring others together and feel most alive in good conversation.",
      strengths: ["Warmth", "Making people feel welcome", "Building bridges"],
      care: "Check that you are being filled up too, not only giving. Who asks how you are?",
      connect: "Start something small and regular: a weekly call, a shared meal, a group chat with a purpose.",
    },
    creator: {
      name: "The Maker",
      line: "You understand the world by making things. Ideas want to come out through your hands.",
      strengths: ["Imagination", "Original thinking", "Turning feelings into something real"],
      care: "Make things just for you, with no audience. Play is not wasted time.",
      connect: "Join a class, a club or an open studio. Making beside others is an easy way to belong.",
    },
    explorer: {
      name: "The Explorer",
      line: "You are curious and restless in a good way. New places, people and ideas keep you growing.",
      strengths: ["Curiosity", "Adaptability", "Courage to try"],
      care: "Give yourself permission to change your mind. Wandering is part of finding.",
      connect: "Say yes to one new thing this week, and bring someone along to share it with.",
    },
    caregiver: {
      name: "The Nurturer",
      line: "You feel deeply and you care for people instinctively. Others feel safe around you.",
      strengths: ["Empathy", "Patience", "Making people feel seen"],
      care: "Offer yourself the kindness you give everyone else. You are allowed to need things too.",
      connect: "Volunteering or helping in your community can turn care into lasting connection.",
    },
    builder: {
      name: "The Builder",
      line: "You like to make things work. You turn plans into progress and people trust you to follow through.",
      strengths: ["Reliability", "Practical problem-solving", "Focus"],
      care: "Not everything needs fixing. Some feelings just need to be felt.",
      connect: "Shared projects suit you: a garden, a team, a community repair day.",
    },
    seeker: {
      name: "The Seeker",
      line: "You are drawn to big questions: meaning, purpose, why things are the way they are.",
      strengths: ["Wisdom", "Perspective", "Asking questions that matter"],
      care: "You don't need every answer to begin. Living the question is enough for now.",
      connect: "Look for people who like deep talk: book clubs, discussion groups, long late-night chats.",
    },
    anchor: {
      name: "The Anchor",
      line: "You are steady and calm. In a storm, people hold on to you.",
      strengths: ["Calm", "Loyalty", "Being dependable"],
      care: "Steady people still get tired. Let someone else hold you sometimes.",
      connect: "Keep up your small rituals with people: the same café, the same Sunday call. Consistency is connection.",
    },
  };
  const THREAD_ORDER = Object.keys(THREADS);

  const QUESTIONS = [
    {
      id: "restore",
      text: "After a long week, what sounds most restoring?",
      options: [
        { label: "Quiet time alone with my thoughts", w: { reflective: 2, anchor: 1 } },
        { label: "Dinner or a call with people I love", w: { connector: 2, caregiver: 1 } },
        { label: "Making something: cooking, drawing, music", w: { creator: 2 } },
        { label: "Going somewhere I've never been", w: { explorer: 2 } },
      ],
    },
    {
      id: "friend",
      text: "A friend is going through a hard time. You're most likely to…",
      options: [
        { label: "Listen for as long as they need", w: { caregiver: 2, anchor: 1 } },
        { label: "Help them make a plan", w: { builder: 2 } },
        { label: "Take their mind off it with something fun", w: { connector: 1, explorer: 1 } },
        { label: "Help them see the bigger picture", w: { seeker: 2 } },
      ],
    },
    {
      id: "compliment",
      text: "Which compliment would mean the most to you?",
      options: [
        { label: "“You really understand people.”", w: { caregiver: 2, reflective: 1 } },
        { label: "“You're so creative.”", w: { creator: 2 } },
        { label: "“I can always count on you.”", w: { anchor: 2, builder: 1 } },
        { label: "“You make me see things differently.”", w: { seeker: 1, explorer: 1, reflective: 1 } },
      ],
    },
    {
      id: "saturday",
      text: "A free Saturday with no plans. You…",
      options: [
        { label: "Let the day unfold and see what happens", w: { explorer: 2 } },
        { label: "Finally get stuck into a project", w: { builder: 2 } },
        { label: "Get lost in a book, a film or my own thoughts", w: { reflective: 2, seeker: 1 } },
        { label: "Message people to see who's around", w: { connector: 2 } },
      ],
    },
    {
      id: "flow",
      text: "What makes you lose track of time?",
      options: [
        { label: "Talking with someone about life", w: { connector: 1, seeker: 1, caregiver: 1 } },
        { label: "Creating or imagining", w: { creator: 2 } },
        { label: "Learning something new", w: { explorer: 1, seeker: 1 } },
        { label: "Organising, fixing or improving things", w: { builder: 2 } },
      ],
    },
    {
      id: "wrong",
      text: "When things go wrong, your first instinct is to…",
      options: [
        { label: "Stay calm and steady", w: { anchor: 2 } },
        { label: "Work out what to do next", w: { builder: 2 } },
        { label: "Feel it fully and take time to process", w: { reflective: 2 } },
        { label: "Reach out to someone", w: { connector: 2 } },
      ],
    },
    {
      id: "place",
      text: "Which place feels most like you?",
      options: [
        { label: "A cosy room with rain outside", w: { reflective: 1, anchor: 1 } },
        { label: "A busy café full of conversation", w: { connector: 2 } },
        { label: "A mountain trail at sunrise", w: { explorer: 2 } },
        { label: "A studio or workshop", w: { creator: 1, builder: 1 } },
      ],
    },
    {
      id: "matters",
      text: "What matters most to you right now?",
      options: [
        { label: "Being close to people", w: { connector: 1, caregiver: 1 } },
        { label: "Growing into who I'm meant to be", w: { seeker: 2 } },
        { label: "Freedom and new experiences", w: { explorer: 2 } },
        { label: "Security and peace", w: { anchor: 2 } },
      ],
    },
    {
      id: "misread",
      text: "People sometimes misread you as…",
      options: [
        { label: "Quiet or distant, when really I'm just thinking", w: { reflective: 2 } },
        { label: "Too much, when really I'm just excited", w: { connector: 1, explorer: 1 } },
        { label: "Too serious, when I just care about doing it right", w: { builder: 2 } },
        { label: "Too soft, when I just feel things deeply", w: { caregiver: 2 } },
      ],
    },
    {
      id: "legacy",
      text: "If you could leave one thing behind in the world, it would be…",
      options: [
        { label: "Something beautiful I made", w: { creator: 2 } },
        { label: "People who felt loved by me", w: { caregiver: 2 } },
        { label: "A question that changed how someone thinks", w: { seeker: 2 } },
        { label: "Something solid that lasts", w: { builder: 1, anchor: 1 } },
      ],
    },
  ];

  // answers: { [questionId]: optionIndex }. Unanswered or out-of-range answers are ignored.
  function scoreAnswers(answers) {
    const scores = {};
    THREAD_ORDER.forEach((t) => (scores[t] = 0));
    QUESTIONS.forEach((q) => {
      const opt = q.options[answers && answers[q.id]];
      if (!opt) return;
      Object.keys(opt.w).forEach((t) => (scores[t] += opt.w[t]));
    });
    return scores;
  }

  // Strongest threads first; ties keep THREAD_ORDER so the same answers always give the same portrait.
  function rankThreads(scores) {
    return THREAD_ORDER.slice().sort((a, b) => scores[b] - scores[a] || THREAD_ORDER.indexOf(a) - THREAD_ORDER.indexOf(b));
  }

  function buildPortrait(answers) {
    const scores = scoreAnswers(answers);
    const ranked = rankThreads(scores);
    const answered = QUESTIONS.filter((q) => q.options[answers && answers[q.id]]).length;
    if (answered === 0) throw new Error("Answer at least one question first.");
    const [first, second] = ranked;
    const a = THREADS[first];
    const b = THREADS[second];
    const hasSecond = scores[second] > 0;
    return {
      primary: first,
      secondary: hasSecond ? second : null,
      scores,
      title: hasSecond ? `${a.name}, with a thread of ${b.name.replace(/^The /, "the ")}` : a.name,
      summary: hasSecond ? `${a.line} ${b.line}` : a.line,
      strengths: unique(a.strengths.concat(hasSecond ? b.strengths : [])).slice(0, 5),
      care: a.care,
      connect: hasSecond ? [a.connect, b.connect] : [a.connect],
      answered,
      total: QUESTIONS.length,
    };
  }

  // A short plain-text description the companion can use, only if the person chooses to share it.
  function portraitForCompanion(p) {
    if (!p || !THREADS[p.primary]) return "";
    const parts = [`Their self-discovery portrait: ${p.title}.`, `Strengths: ${p.strengths.join(", ")}.`];
    return parts.join(" ");
  }

  function unique(list) {
    return list.filter((x, i) => list.indexOf(x) === i);
  }

  const MOODS = [
    { id: "heavy", label: "Heavy", emoji: "\u{1F327}️" },
    { id: "lonely", label: "Lonely", emoji: "\u{1F311}" },
    { id: "anxious", label: "Anxious", emoji: "\u{1F32A}️" },
    { id: "okay", label: "Okay", emoji: "⛅" },
    { id: "bright", label: "Bright", emoji: "☀️" },
  ];

  const MOOD_SUGGESTIONS = {
    heavy: {
      message: "Thank you for being honest. Heavy days are real, and you don't have to carry them alone.",
      actions: [
        { route: "companion", label: "Talk it through with the companion" },
        { route: "create", label: "Write it down, just for you" },
        { route: "help", label: "Talk to a person now" },
      ],
    },
    lonely: {
      message: "Loneliness is one of the most human feelings there is. Lots of people here know it too.",
      actions: [
        { route: "thoughts", label: "Read what others are feeling" },
        { route: "companion", label: "Have a chat right now" },
        { route: "discover", label: "Find ideas for connecting that suit you" },
      ],
    },
    anxious: {
      message: "Let's slow things down together. Your body can help your mind settle.",
      actions: [
        { route: "breathe", label: "Try one minute of breathing" },
        { route: "companion", label: "Say what's on your mind" },
      ],
    },
    okay: {
      message: "Okay is a good place to explore from.",
      actions: [
        { route: "discover", label: "Discover who you are" },
        { route: "create", label: "Try a creative prompt" },
      ],
    },
    bright: {
      message: "Lovely. Maybe share some of that light with someone today.",
      actions: [
        { route: "thoughts", label: "Leave a kind word for someone" },
        { route: "create", label: "Capture what's good right now" },
      ],
    },
  };

  const CREATIVE_PROMPTS = [
    "Write a short letter to yourself at age ten. What would you want them to know?",
    "If your mood today were weather, what would it be? Describe it.",
    "Describe yourself as a place. What does it look, sound and smell like?",
    "List five small things that made you feel even a little bit good this week.",
    "What's something you've never told anyone, but wish someone knew about you?",
    "Write about a moment you felt completely like yourself.",
    "If you could have a conversation with anyone, living or not, who and why?",
    "What would you do with a whole day if no one expected anything of you?",
    "Write a thank-you note to a part of your body that works hard for you.",
    "Which song feels like your life right now? What line stands out?",
    "Describe the kindest thing a stranger ever did for you.",
    "What is one thing you're slowly getting better at?",
    "Imagine yourself a year from now, doing well. What does an ordinary day look like?",
    "What do you miss? What does missing it tell you about what you love?",
  ];

  // Crisis language triggers the "you're not alone, here is real help" card. It is a safety
  // net, not a diagnosis: it errs on the side of offering help.
  const CRISIS_PATTERNS = [
    /\bkill(ing)? my ?self\b/,
    /\bsuicid(e|al)\b/,
    /\bend(ing)? (my|it) (life|all)\b/,
    /\bend it all\b/,
    /\b(want|wanna|going) to die\b/,
    /\bdon'?t want to (live|be alive|be here|exist)( anymore)?\b/,
    /\bno (reason|point) (to|in) (live|living|going on)\b/,
    /\bbetter off (dead|without me)\b/,
    /\bself[- ]?harm(ing)?\b/,
    /\b(hurt|cut|harm)(ing)? my ?self\b/,
    /\btake my (own )?life\b/,
  ];

  function detectCrisis(text) {
    if (typeof text !== "string") return false;
    const t = text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
    return CRISIS_PATTERNS.some((re) => re.test(t));
  }

  const LIMITS = { thought: 1000, comment: 500, name: 30, chatMessage: 2000, chatHistory: 20 };

  function cleanText(value) {
    if (typeof value !== "string") return "";
    // Drop control characters except newlines and tabs, collapse runs of blank lines.
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function validateText(value, max, what) {
    const text = cleanText(value);
    if (!text) throw invalid(`${what} can't be empty.`);
    if (text.length > max) throw invalid(`${what} must be ${max} characters or fewer.`);
    return text;
  }

  function invalid(message) {
    const e = new Error(message);
    e.status = 400;
    return e;
  }

  function cleanName(value) {
    const name = cleanText(value).replace(/\s+/g, " ").slice(0, LIMITS.name);
    return name || "Someone";
  }

  // Keep only well-formed chat turns, newest last, alternating roles starting with the user.
  function cleanChatHistory(messages) {
    if (!Array.isArray(messages)) return [];
    const turns = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: cleanText(m.content).slice(0, LIMITS.chatMessage) }))
      .filter((m) => m.content)
      .slice(-LIMITS.chatHistory);
    const out = [];
    turns.forEach((m) => {
      if (out.length === 0 && m.role !== "user") return;
      if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n\n" + m.content;
      else out.push(m);
    });
    return out;
  }

  function timeAgo(iso, now) {
    const s = Math.max(0, Math.round(((now || Date.now()) - Date.parse(iso)) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return d === 1 ? "yesterday" : `${d} days ago`;
  }

  return {
    THREADS,
    THREAD_ORDER,
    QUESTIONS,
    MOODS,
    MOOD_SUGGESTIONS,
    CREATIVE_PROMPTS,
    LIMITS,
    scoreAnswers,
    rankThreads,
    buildPortrait,
    portraitForCompanion,
    detectCrisis,
    cleanText,
    validateText,
    cleanName,
    cleanChatHistory,
    timeAgo,
  };
});
