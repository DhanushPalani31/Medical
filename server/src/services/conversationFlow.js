/**
 * Guided conversation state machine.
 *
 * Why guided instead of free-form NLU: see README "Why a guided conversation,
 * not free-form chat". The model needs exactly five fields (age, gender,
 * disease, symptoms, history). Rather than firing a second LLM call to parse
 * freeform text into those fields (extra latency + another failure point for
 * a live client demo), we ask for each field one at a time. The whole
 * request/response surface for this logic lives in this one file — swapping
 * in real NLU extraction later only touches `extractField` below.
 */

const STEPS = ["age", "gender", "disease", "symptoms", "history", "confirm", "done"];

const PROMPTS = {
  age: "Hi! I can help predict a prescription based on a patient's clinical picture. Let's start — what's the patient's age?",
  gender: "Got it. What's the patient's gender (Male / Female / Other)?",
  disease: "Thanks. What condition has the patient been diagnosed with (e.g. Myocardial Infarction, Type 2 Diabetes)?",
  symptoms: "Okay. What symptoms is the patient presenting with? You can list a few, e.g. \"chest pain, sweating, shortness of breath\".",
  history: "Last one — any relevant medical history (e.g. hypertension, diabetes)? If none, just say \"none\".",
};

function normalizeGender(raw) {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("m")) return "Male";
  if (v.startsWith("f")) return "Female";
  return "Other";
}

function extractAge(raw) {
  const match = raw.match(/\d{1,3}/);
  if (!match) return null;
  const age = parseInt(match[0], 10);
  if (Number.isNaN(age) || age <= 0 || age > 120) return null;
  return age;
}

/**
 * Given the current conversation state and the user's latest message,
 * returns { fields, step, botMessage, readyForPrediction }.
 */
export function advanceConversation(convo, userText) {
  const text = (userText || "").trim();
  let { step, fields } = convo;

  if (!STEPS.includes(step)) step = "age";

  switch (step) {
    case "age": {
      const age = extractAge(text);
      if (age === null) {
        return {
          fields,
          step,
          botMessage: "I didn't catch a valid age there — could you give me a number between 1 and 120?",
          readyForPrediction: false,
        };
      }
      fields = { ...fields, age };
      step = "gender";
      break;
    }
    case "gender": {
      if (!text) {
        return { fields, step, botMessage: PROMPTS.gender, readyForPrediction: false };
      }
      fields = { ...fields, gender: normalizeGender(text) };
      step = "disease";
      break;
    }
    case "disease": {
      if (!text) {
        return { fields, step, botMessage: PROMPTS.disease, readyForPrediction: false };
      }
      fields = { ...fields, disease: text };
      step = "symptoms";
      break;
    }
    case "symptoms": {
      if (!text) {
        return { fields, step, botMessage: PROMPTS.symptoms, readyForPrediction: false };
      }
      fields = { ...fields, symptoms: text };
      step = "history";
      break;
    }
    case "history": {
      const history = /^(none|no|n\/a|nil)$/i.test(text) ? "none" : text;
      fields = { ...fields, history };
      step = "confirm";
      break;
    }
    case "confirm": {
      // Any input here just moves forward — the client shows a summary and
      // a "yes, predict" affordance rather than requiring exact text.
      step = "done";
      return { fields, step, botMessage: null, readyForPrediction: true };
    }
    default:
      break;
  }

  if (step === "confirm") {
    const summary =
      `Here's what I've got:\n` +
      `• Age: ${fields.age}\n` +
      `• Gender: ${fields.gender}\n` +
      `• Condition: ${fields.disease}\n` +
      `• Symptoms: ${fields.symptoms}\n` +
      `• History: ${fields.history}\n\n` +
      `Want me to predict the prescription now?`;
    return { fields, step, botMessage: summary, readyForPrediction: false };
  }

  return { fields, step, botMessage: PROMPTS[step], readyForPrediction: false };
}

export function firstPrompt() {
  return PROMPTS.age;
}

export function allFieldsCollected(fields) {
  return Boolean(
    fields &&
      fields.age &&
      fields.gender &&
      fields.disease &&
      fields.symptoms &&
      fields.history
  );
}
