// api/submit.js

// Normalize string (lowercase, collapse spaces, trim)
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein distance to allow small spelling mistakes
function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);

  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

function isCorrectAnswer(studentAnswer, variants) {
  const s = normalize(studentAnswer);
  if (!s) return false;

  for (const v of variants) {
    const target = normalize(v);
    if (!target) continue;

    if (s === target) return true;

    const dist = levenshtein(s, target);
    // allow small spelling mistakes
    if (dist <= 2) return true;
  }

  return false;
}

// Correct answers list – students write the WHOLE missing part
const correctAnswers = {
  1: ["had already cooked"],
  2: ["had been studying"],
  3: ["had not finished", "hadn't finished"],
  4: ["had been trying"],
  5: ["had been crying"],
  6: ["had not seen", "hadn't seen"],
  7: ["had been waiting"],
  8: ["had been playing"],
  9: ["had not been sleeping", "hadn't been sleeping"],
  10: ["had just washed"],
  11: ["had she put", "had put"],
  12: ["had been working", "had worked"],
  13: ["had never been"],
  14: ["had not been paying", "hadn't been paying"],
  15: ["had he said"],
  16: ["had been driving"],
  17: ["had been practising", "had been practicing"],
  18: ["had not met", "hadn't met"],
  19: ["had she visited"],
  20: ["had already left"],
  21: ["had been looking"],
  22: ["had been living"],
  23: ["had not read", "hadn't read"],
  24: ["had been working"],
  25: ["had left", "had already left"],
  26: ["had not eaten", "hadn't eaten"],
  27: ["had been laughing"],
  28: ["had been sleeping"],
  29: ["had not cleaned", "hadn't cleaned"],
  30: ["had been playing"]
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Only POST allowed" });
      return;
    }

    const { name, group, answers } = req.body || {};

    if (!name || !group || !answers) {
      res
        .status(400)
        .json({ success: false, message: "Missing name, group or answers" });
      return;
    }

    let score = 0;
    const total = 30;
    const details = [];

    for (let i = 1; i <= total; i++) {
      const key = "q" + i;
      const studentAnswer = (answers[key] || "").toString();
      const variants = correctAnswers[i] || [];
      const correct = isCorrectAnswer(studentAnswer, variants);

      if (correct) score++;

      details.push({
        question: i,
        studentAnswer,
        correct,
        correctAnswers: variants
      });
    }

    // Prepare Telegram message
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const messageLines = [];
    messageLines.push("🧪 New Grammar Test Result");
    messageLines.push(`👤 Name: ${name}`);
    messageLines.push(`👥 Group: ${group}`);
    messageLines.push(`✅ Score: ${score} / ${total}`);
    messageLines.push("");
    messageLines.push("Answers:");

    details.forEach((d) => {
      messageLines.push(
        `${d.question}) Student: "${d.studentAnswer}" | Correct: ${
          d.correct ? "✅" : "❌"
        } | Key: ${d.correctAnswers.join(" / ")}`
      );
    });

    const messageText = messageLines.join("\n");

    // Send to Telegram (if env vars set)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: messageText,
              parse_mode: "HTML"
            })
          }
        );
      } catch (err) {
        console.error("Error sending Telegram message:", err);
        // Do NOT fail the student if Telegram fails
      }
    } else {
      console.warn(
        "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in environment."
      );
    }

    res.status(200).json({
      success: true,
      score,
      total,
      results: details
    });
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
