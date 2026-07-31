export const INTEGRATION_SCHEMA_VERSION = "1.0.0";
export const STORAGE_PREFIX = "tdas.202.study.v1.";

export const STORAGE_KEYS = Object.freeze({
  profile: `${STORAGE_PREFIX}profile`,
  attempts: `${STORAGE_PREFIX}attempts`,
  session: `${STORAGE_PREFIX}session`,
  answers: `${STORAGE_PREFIX}answers`,
  errors: `${STORAGE_PREFIX}errors`,
  marked: `${STORAGE_PREFIX}marked`,
  reviews: `${STORAGE_PREFIX}reviews`,
  aiQueue: `${STORAGE_PREFIX}aiQueue`,
  peProgress: `${STORAGE_PREFIX}peProgress`,
  meta: `${STORAGE_PREFIX}meta`,
});

export const RESPONSE_CLASSIFICATIONS = Object.freeze([
  "incorrect_confirmed",
  "correct_secure",
  "correct_with_doubt",
  "correct_by_guess",
  "marked",
  "annulment_pending",
  "source_error",
]);

export const ERROR_BOOK_ELIGIBLE = Object.freeze(["incorrect_confirmed"]);
export const REVIEW_STAGES = Object.freeze(["D+1", "D+7", "D+20"]);

export const SOURCE_METADATA = Object.freeze({
  repository: "RodrigoRosaDantas/sedes-df-questoes",
  referenceVersion: "2.12.4",
  importPolicy: "selective-with-origin-record",
});

export function makeStorageKey(name) {
  if (!Object.hasOwn(STORAGE_KEYS, name)) {
    throw new TypeError(`Chave de armazenamento desconhecida: ${String(name)}`);
  }
  return STORAGE_KEYS[name];
}

export function isValidPeId(value) {
  const match = /^PE(0[1-9]|[1-9]\d|1[01]\d|112)$/.exec(String(value || ""));
  if (!match) return false;
  const number = Number(match[1]);
  return number >= 1 && number <= 112;
}

export function isKnownResponseClassification(value) {
  return RESPONSE_CLASSIFICATIONS.includes(String(value || ""));
}

export function isErrorBookEligible(classification) {
  return ERROR_BOOK_ELIGIBLE.includes(String(classification || ""));
}

export function validateStudyEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return {valid: false, reason: "event-invalid"};
  }
  if (!isValidPeId(event.peId)) return {valid: false, reason: "pe-invalid"};
  if (!String(event.questionId || "").trim()) return {valid: false, reason: "question-id-missing"};
  if (!isKnownResponseClassification(event.classification)) {
    return {valid: false, reason: "classification-invalid"};
  }
  if (event.classification === "incorrect_confirmed" && !String(event.answer ?? "").trim()) {
    return {valid: false, reason: "blank-answer-cannot-be-error"};
  }
  return {valid: true, reason: null};
}
