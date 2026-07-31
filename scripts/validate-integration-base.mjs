import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async relative => fs.readFile(path.join(root, relative), "utf8");
const exists = async relative => fs.access(path.join(root, relative)).then(() => true).catch(() => false);
const fail = message => { throw new Error(`Base de integração: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };

const requiredFiles = [
  "package.json",
  "assets/integration/contracts.js",
  "data/integration/base-contract.json",
  "docs/integration/ORIGIN.md",
  "docs/integration/phase-1/SNAPSHOT.md",
  "docs/integration/phase-1/INVENTORY.md",
  "docs/integration/phase-1/PLAN.md",
  "docs/integration/phase-1/REPORT.md",
];
for (const file of requiredFiles) requireValue(await exists(file), `arquivo obrigatório ausente: ${file}`);

const packageData = JSON.parse(await read("package.json"));
requireValue(packageData.private === true, "package.json deve permanecer privado");
requireValue(packageData.type === "module", "package.json deve usar módulos ES");
requireValue(packageData.scripts?.check === "node scripts/validate-platform.mjs && node scripts/validate-integration-base.mjs", "npm run check não encadeia as validações esperadas");
requireValue(packageData.scripts?.["check:integration"] === "node scripts/validate-integration-base.mjs", "check:integration ausente");

const contract = JSON.parse(await read("data/integration/base-contract.json"));
const moduleUrl = pathToFileURL(path.join(root, "assets/integration/contracts.js")).href;
const runtime = await import(`${moduleUrl}?validation=${Date.now()}`);

requireValue(contract.schemaVersion === runtime.INTEGRATION_SCHEMA_VERSION, "schema divergente entre JSON e JavaScript");
requireValue(/^\d+\.\d+\.\d+$/.test(contract.schemaVersion), "schemaVersion inválido");
requireValue(/^[0-9a-f]{40}$/.test(contract.platform?.baseCommit || ""), "commit-base inválido");
requireValue(contract.platform?.repository === "RodrigoRosaDantas/sedes-tdas-dashboard", "repositório de destino inválido");
requireValue(contract.platform?.baseBranch === "main", "branch-base deve ser main");
requireValue(contract.platform?.integrationBranch === "agent/integracao-base-fase-1", "branch de integração divergente");
requireValue(contract.platform?.profileId === "rodrigo", "perfil deve ser exclusivamente Rodrigo");
requireValue(contract.platform?.cargoCode === "202", "cargo deve ser exclusivamente 202");
requireValue(contract.questionSource?.repository === runtime.SOURCE_METADATA.repository, "origem técnica divergente");
requireValue(contract.questionSource?.referenceVersion === runtime.SOURCE_METADATA.referenceVersion, "versão de origem divergente");

const jsonKeys = contract.storage?.keys || {};
const runtimeKeys = runtime.STORAGE_KEYS || {};
requireValue(contract.storage?.prefix === runtime.STORAGE_PREFIX, "prefixo de armazenamento divergente");
requireValue(JSON.stringify(jsonKeys) === JSON.stringify(runtimeKeys), "chaves de armazenamento divergentes");
const values = Object.values(jsonKeys);
requireValue(values.length === 10, "quantidade inesperada de chaves de armazenamento");
requireValue(new Set(values).size === values.length, "há chaves de armazenamento duplicadas");
requireValue(values.every(value => value.startsWith(runtime.STORAGE_PREFIX)), "há chave fora do namespace TDAS 202 v1");

requireValue(JSON.stringify(contract.responseClassifications) === JSON.stringify(runtime.RESPONSE_CLASSIFICATIONS), "classificações divergentes");
requireValue(new Set(contract.responseClassifications).size === contract.responseClassifications.length, "classificações duplicadas");
requireValue(JSON.stringify(contract.errorBookEligible) === JSON.stringify(runtime.ERROR_BOOK_ELIGIBLE), "regra do caderno de erros divergente");
requireValue(JSON.stringify(contract.reviewPolicy?.stages) === JSON.stringify(runtime.REVIEW_STAGES), "janelas de revisão divergentes");
requireValue(contract.reviewPolicy?.immediateCorrection === true, "correção imediata deve permanecer habilitada");
requireValue(contract.reviewPolicy?.exceptionalStage === "D0", "estágio excepcional D0 ausente");

for (const [key, value] of Object.entries(contract.phase1 || {})) {
  requireValue(value === false, `fase 1 não pode ativar ${key}`);
}

requireValue(runtime.makeStorageKey("attempts") === "tdas.202.study.v1.attempts", "makeStorageKey retornou valor inesperado");
let unknownKeyRejected = false;
try { runtime.makeStorageKey("unknown"); } catch { unknownKeyRejected = true; }
requireValue(unknownKeyRejected, "chave desconhecida não foi rejeitada");
requireValue(runtime.isValidPeId("PE01"), "PE01 deveria ser válido");
requireValue(runtime.isValidPeId("PE112"), "PE112 deveria ser válido");
requireValue(!runtime.isValidPeId("PE00"), "PE00 deveria ser inválido");
requireValue(!runtime.isValidPeId("PE113"), "PE113 deveria ser inválido");
requireValue(!runtime.isValidPeId("S05"), "S05 deveria ser inválido no contrato TDAS");
requireValue(runtime.isErrorBookEligible("incorrect_confirmed"), "erro confirmado deveria ser elegível");
requireValue(!runtime.isErrorBookEligible("annulment_pending"), "anulabilidade pendente não pode virar erro definitivo");
requireValue(!runtime.isErrorBookEligible("correct_by_guess"), "acerto por chute não pode virar erro definitivo");

const validEvent = runtime.validateStudyEvent({
  peId: "PE76",
  questionId: "PE76-Q01",
  classification: "correct_with_doubt",
  answer: "D",
});
requireValue(validEvent.valid, `evento válido foi rejeitado: ${validEvent.reason}`);
const blankError = runtime.validateStudyEvent({
  peId: "PE76",
  questionId: "PE76-Q02",
  classification: "incorrect_confirmed",
  answer: null,
});
requireValue(!blankError.valid && blankError.reason === "blank-answer-cannot-be-error", "resposta em branco poderia virar erro");

if (await exists("index.html")) {
  const index = await read("index.html");
  requireValue(!index.includes("assets/integration/contracts.js"), "contrato foi ligado ao runtime antes da fase apropriada");
}
if (await exists("sw.js")) {
  const worker = await read("sw.js");
  requireValue(!worker.includes("assets/integration/contracts.js"), "contrato foi incluído no service worker na fase 1");
}

const snapshot = await read("docs/integration/phase-1/SNAPSHOT.md");
requireValue(snapshot.includes(contract.platform.baseCommit), "snapshot não registra o commit-base");
const origin = await read("docs/integration/ORIGIN.md");
requireValue(origin.includes(contract.questionSource.repository), "registro de origem não contém o repositório fonte");

console.log("✓ Base de integração validada: contratos, namespace, estados de resposta e isolamento da fase 1.");
