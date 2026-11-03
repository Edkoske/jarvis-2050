const registry = [];
const register = (category, pattern, handler) => registry.push({ category, pattern, handler });

register("conversation", /^(hi|hello|hey)( jarvis)?[!. ]*$/, () => ({ text: "Hello. All systems are ready. What would you like to do?" }));
register("conversation", /joke/, () => ({ text: "Why did the AI bring a ladder? It wanted to reach the next level. My humour module is still learning." }));
register("time and date", /\b(time|clock)\b/, () => ({ text: `It's ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())}.` }));
register("time and date", /\b(today'?s date|what date|date today|what day)\b/, () => ({ text: `Today is ${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}.` }));
register("navigation", /\b(calculator|calculate)\b/, () => ({ text: "Opening your calculator.", app: "calculator" }));
register("productivity", /\b(notes?|show my notes)\b/, () => ({ text: "Opening your private notes.", app: "notes" }));
register("productivity", /\b(tasks?|to-?do|my tasks)\b/, () => ({ text: "Here are your tasks.", app: "tasks" }));
register("navigation", /\b(calendar|schedule)\b/, () => ({ text: "Opening your calendar.", app: "calendar" }));
register("music", /\b(music|player)\b/, () => ({ text: "Opening your music player. Add your own audio files to begin.", app: "music" }));
register("system utilities", /\b(system|monitor|device info)\b/, () => ({ text: "Opening the system monitor. Browser-reported and simulated values are labelled separately.", app: "system" }));
register("system utilities", /\b(timer|countdown|stopwatch)\b/, () => ({ text: "Opening your timer and stopwatch.", app: "timer" }));
register("navigation", /\b(open )?(google|browser|web)\b/, (context) => {
  context.openLink("https://www.google.com/");
  return { text: "Opening Google in a new tab." };
});
register("display settings", /\b(change|switch|toggle) (the )?theme\b/, (context) => {
  const theme = context.theme === "dark" ? "light" : "dark";
  context.setTheme(theme);
  return { text: `Theme changed to ${theme} mode.` };
});
register("display settings", /\b(full ?screen|fullscreen)\b/, () => ({ text: "Entering fullscreen mode.", action: "fullscreen" }));
register("system utilities", /\b(weather|temperature)\b/, () => ({ text: "Search for a city in the Weather panel. Current weather is fetched from Open-Meteo when requested.", action: "weather" }));

export function addCommand(category, pattern, handler) {
  if (typeof category !== "string" || !(pattern instanceof RegExp) || typeof handler !== "function") throw new TypeError("Register commands with a category, RegExp, and handler.");
  registry.push({ category, pattern, handler });
}

export function listCommandCategories() { return [...new Set(registry.map((item) => item.category))]; }

export async function processCommand(input, context) {
  const text = input.trim().slice(0, 240);
  if (!text) return { text: "Please enter a command." };
  const command = text.toLocaleLowerCase();
  const match = registry.find((entry) => {
    entry.pattern.lastIndex = 0;
    return entry.pattern.test(command);
  });
  if (!match) return { text: `I don't have a command for “${text}” yet. Try asking for the time, opening Notes or Calculator, showing your tasks, or changing the theme.` };
  try { return await match.handler(context, text); }
  catch (error) { return { text: `I couldn't complete that command: ${error.message}` }; }
}
