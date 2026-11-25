// Consulta somente leitura à API oficial, sem autenticação nem tokens.
import { writeFile } from "node:fs/promises";
const actions = [["actions/checkout", "v4"], ["actions/setup-python", "v5"],
  ["actions/setup-node", "v4"], ["actions/upload-artifact", "v4"], ["gitleaks/gitleaks-action", "v2"]];
const verified = [];
for (const [repo, version] of actions) {
  const url = `https://api.github.com/repos/${repo}/git/ref/tags/${version}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  let ref = await response.json();
  if (ref.object.type === "tag") ref = await (await fetch(ref.object.url)).json();
  const commit = await fetch(`https://api.github.com/repos/${repo}/git/commits/${ref.object.sha}`);
  if (!commit.ok) throw new Error(`Not a commit: ${repo} ${ref.object.sha}`);
  verified.push({ repo, version, sha: ref.object.sha, source: url });
}
await writeFile("docs/tasks/01-actions-verificados.json", JSON.stringify(verified, null, 2) + "\n");
console.log(JSON.stringify(verified, null, 2));
