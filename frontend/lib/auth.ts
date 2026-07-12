/* A sessão NÃO mora mais aqui.
 *
 * O JWT vive num cookie httpOnly emitido pelo backend: este arquivo não consegue
 * lê-lo, e é esse justamente o ponto — um XSS não tem de onde roubar a sessão.
 * Nada de localStorage, sessionStorage, IndexedDB ou cookie escrito por JS.
 *
 * Só o token CSRF fica aqui, em memória (nunca persistido). Ele não é segredo de
 * sessão: serve para provar que a requisição partiu da nossa própria origem.
 */

let csrfToken: string | null = null;

export const getCsrfToken = () => csrfToken;
export const setCsrfToken = (t: string) => { csrfToken = t; };
export const clearCsrfToken = () => { csrfToken = null; };
