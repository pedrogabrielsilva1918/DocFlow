// Vendored from @openai/sites-vite-plugin 0.2.0 (openai/sites#9).
// See sites-vite-plugin.LICENSE for the upstream MIT license.
import { access, cp, mkdir, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const testAccounts = {
  admin: { cookie: "1", id: "local_seedy", email: "seedy@sites.test", name: "Administrador de teste" },
  applicant: { cookie: "applicant", id: "local_applicant", email: "solicitante@sites.test", name: "Solicitante de teste" },
};
const localCookieName = "__sites_local_auth";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const authPaths = new Set([
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function sites({ mockAuth = true, developmentOrigin = "" } = {}): Plugin {
  let root = process.cwd();
  let command: "build" | "serve" = "build";

  return {
    name: "sites",
    configResolved(config) {
      root = config.root;
      command = config.command;
    },
    configureServer(server) {
      if (!mockAuth) return;
      const serverSecure = Boolean(server.config.server.https);

      server.config.logger.info("DocFlow: contas de teste disponíveis no login de desenvolvimento.");
      server.middlewares.use((request, response, next) => {
        for (const name of Object.keys(request.headers)) {
          if (name.startsWith("oai-authenticated-user-")) {
            removeHeader(request, name);
          }
        }

        let authority: URL;
        let url: URL;
        let codespaceRequest = false;
        let secure = serverSecure;
        try {
          authority = new URL(
            `${serverSecure ? "https" : "http"}://${request.headers.host}`,
          );
          if (developmentOrigin) {
            const configured = new URL(developmentOrigin);
            const forwarded = request.headers["x-forwarded-host"];
            codespaceRequest = authority.host === configured.host ||
              (localHosts.has(authority.hostname) && forwarded === configured.host);
            if (codespaceRequest) {
              authority = configured;
              secure = true;
            }
          }
          url = new URL(request.url ?? "/", authority);
        } catch {
          if (authPaths.has((request.url ?? "/").split("?")[0])) {
            respond(response, 403);
          } else {
            next();
          }
          return;
        }

        const hostname = authority.hostname
          .replace(/^\[|\]$/g, "")
          .toLowerCase();
        if (
          (!codespaceRequest && (!localHosts.has(hostname) ||
          !localAddresses.has(request.socket.remoteAddress ?? ""))) ||
          url.origin !== authority.origin
        ) {
          if (authPaths.has(url.pathname)) respond(response, 403);
          else next();
          return;
        }

        const cookies = (request.headers.cookie ?? "")
          .split(";")
          .map((cookie) => cookie.trim())
          .filter(Boolean);
        const signInCookies = cookies
          .filter((cookie) => cookie.startsWith(`${localCookieName}=`))
          .map((cookie) => cookie.slice(localCookieName.length + 1));
        const applicationCookies = cookies.filter(
          (cookie) => !cookie.startsWith(`${localCookieName}=`),
        );
        if (applicationCookies.length !== cookies.length) {
          removeHeader(request, "cookie");
          if (applicationCookies.length) {
            setHeader(request, "cookie", applicationCookies.join("; "));
          }
        }

        if (url.pathname === "/callback") {
          respond(response, 501);
          return;
        }

        const signIn = url.pathname === "/signin-with-chatgpt";
        const signOut = url.pathname === "/signout-with-chatgpt";
        if (!signIn && !signOut) {
          const account = signInCookies.length === 1
            ? Object.values(testAccounts).find((account) => account.cookie === signInCookies[0])
            : undefined;
          if (account) {
            setHeader(request, "oai-authenticated-user-id", account.id);
            setHeader(request, "oai-authenticated-user-email", account.email);
            setHeader(request, "oai-authenticated-user-full-name", encodeURIComponent(account.name));
            setHeader(request, "oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
          }
          next();
          return;
        }

        if (
          (request.headers.origin && request.headers.origin !== url.origin) ||
          request.headers["sec-fetch-site"] === "cross-site"
        ) {
          respond(response, 403);
          return;
        }

        if (
          request.headers["next-router-prefetch"] !== undefined ||
          request.headers["x-middleware-prefetch"] === "1" ||
          [request.headers.purpose, request.headers["sec-purpose"]].some(
            (value) =>
              typeof value === "string" &&
              value
                .split(/[;,]/)
                .some((part) => part.trim().toLowerCase() === "prefetch"),
          )
        ) {
          respond(response, 204);
          return;
        }

        if (
          request.method !== "GET" &&
          (!signOut || request.method !== "POST")
        ) {
          response.setHeader("Allow", signIn ? "GET" : "GET, POST");
          respond(response, 405);
          return;
        }

        const selected = url.searchParams.get("account");
        if (signIn && !selected) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "private, no-store");
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
          const returnTo = encodeURIComponent(safeReturn(url.searchParams.get("return_to")));
          response.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contas de teste | DocFlow</title><style>
          *{box-sizing:border-box}body{margin:0;background:#f3f7f4;color:#244436;font:15px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{background:white;padding:36px;border:1px solid #dce7df;border-radius:18px;max-width:540px;width:100%}.brand{font-size:25px;font-weight:750;color:#176a50;letter-spacing:-1px}.badge{display:inline-block;background:#fff2d8;color:#8a681f;padding:6px 10px;border-radius:20px;font-size:11px;margin-top:25px}h1{font-size:26px;line-height:1.3;margin:15px 0}p{color:#7a8e81;line-height:1.8;font-size:13px}a{display:block;text-decoration:none;color:inherit;border:1px solid #dce7df;border-radius:10px;padding:20px;margin-top:14px}a:hover{background:#eef7f0;border-color:#80ad90}a:focus-visible{outline:3px solid #176a50;outline-offset:3px}a strong{display:block;font-size:15px}a span{display:block;font-size:12px;color:#779080;margin-top:8px;line-height:1.6}small{display:block;font-size:11px;color:#8c9e90;line-height:1.8;margin-top:24px}@media(max-width:500px){main{padding:25px}}</style><main><div class="brand">docflow.</div><span class="badge">AMBIENTE DE DESENVOLVIMENTO</span><h1>Com qual conta deseja testar?</h1><p>As contas são fictícias e mantêm documentos separados. Não é necessário informar senha.</p><a href="/signin-with-chatgpt?account=admin&amp;return_to=${returnTo}"><strong>Administrador de teste →</strong><span>Analise solicitações e configure os tipos.<br>seedy@sites.test</span></a><a href="/signin-with-chatgpt?account=applicant&amp;return_to=${returnTo}"><strong>Solicitante de teste →</strong><span>Envie documentos e acompanhe suas solicitações.<br>solicitante@sites.test</span></a><small>Use arquivos fictícios e mantenha a porta do Codespaces privada. Esta seleção existe apenas durante o desenvolvimento.</small></main></html>`);
          return;
        }
        const account = selected === "admin" || selected === "applicant" ? testAccounts[selected] : undefined;
        if (signIn && !account) { respond(response, 400); return; }

        response.statusCode = request.method === "POST" ? 303 : 302;
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader(
          "Location",
          safeReturn(url.searchParams.get("return_to")),
        );
        response.setHeader(
          "Set-Cookie",
          `${localCookieName}=${signIn ? account!.cookie : ""}; Path=/; ${
            signOut ? "Max-Age=0; " : ""
          }HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
        );
        response.end();
      });
    },
    async closeBundle() {
      if (command !== "build") return;

      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}

function removeHeader(request: IncomingMessage, name: string): void {
  delete request.headers[name];
  for (let index = request.rawHeaders.length - 2; index >= 0; index -= 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      request.rawHeaders.splice(index, 2);
    }
  }
}

function setHeader(
  request: IncomingMessage,
  name: string,
  value: string,
): void {
  removeHeader(request, name);
  request.headers[name] = value;
  request.rawHeaders.push(name, value);
}

function respond(response: ServerResponse, status: number): void {
  response.statusCode = status;
  response.setHeader("Cache-Control", "private, no-store");
  response.end();
}

function safeReturn(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || authPaths.has(url.pathname)) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
