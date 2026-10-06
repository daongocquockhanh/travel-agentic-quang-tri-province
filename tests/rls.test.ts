import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Row-level security tests against a real, throwaway Postgres 16 cluster.
 *
 * The migrations are applied as written, except that PostGIS and pgvector
 * (not installed here) are stubbed: geography/vector columns become text and
 * real[], their indexes are skipped, and function bodies aren't validated.
 * The policies under test don't touch those types. Supabase's roles (anon,
 * authenticated, service_role), its default table grants and auth.uid() are
 * recreated so policies behave as they do on Supabase.
 *
 * Skipped automatically when Postgres binaries or a `postgres` user aren't available.
 */

const PG_BIN = "/usr/lib/postgresql/16/bin";
/** Run commands as the postgres OS user: runuser as root (containers), passwordless sudo otherwise (CI). */
const AS_POSTGRES =
  process.getuid?.() === 0 ? ["runuser", "-u", "postgres", "--"] : ["sudo", "-n", "-u", "postgres", "--"];
const canRun =
  existsSync(join(PG_BIN, "initdb")) &&
  spawnSync("id", ["postgres"]).status === 0 &&
  spawnSync(AS_POSTGRES[0], [...AS_POSTGRES.slice(1), "true"]).status === 0;

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const PORT = String(55_000 + Math.floor(Math.random() * 1000));
let dir = "";

function asPostgres(cmd: string, args: string[], input?: string) {
  return spawnSync(AS_POSTGRES[0], [...AS_POSTGRES.slice(1), cmd, ...args], { input, encoding: "utf8" });
}

/** Runs SQL as a Supabase role, optionally as a signed-in user (auth.uid()). */
function sql(statements: string, opts: { role?: "anon" | "authenticated" | "service_role"; uid?: string } = {}) {
  const prelude = [
    opts.uid ? `set request.jwt.claim.sub = '${opts.uid}';` : "",
    opts.role ? `set role ${opts.role};` : "",
  ].join("\n");
  const r = asPostgres(
    "psql",
    ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", dir, "-p", PORT, "-d", "app"],
    `${prelude}\n${statements}`,
  );
  return { out: r.stdout.trim().split("\n").filter(Boolean).at(-1) ?? "", err: r.stderr, ok: r.status === 0 };
}

/** Migration SQL with PostGIS/pgvector stubbed out (see file comment). */
function stubbed(file: string) {
  return readFileSync(join(MIGRATIONS, file), "utf8")
    .replace(/^create extension.*$/gim, "")
    .replace(/geography\(Point,\s*4326\)/g, "text")
    .replace(/vector\(1536\)/g, "real[]")
    .replace(/\(vector,/g, "(real[],")
    .replace(/create index if not exists \w+\s+on public\.\w+\s+using (gist|ivfflat)[\s\S]*?;/gi, "")
    .replace(/create index if not exists \w+ on public\.\w+ using gist \(geom\);/gi, "");
}

const SUPABASE_STUBS = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Supabase grants broad table privileges and relies on RLS to restrict rows.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
set check_function_bodies = off;
`;

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function seed() {
  // auth.users is written by Supabase Auth, not by app roles.
  const users = sql(`insert into auth.users values ('${USER_A}'), ('${USER_B}');`);
  if (!users.ok) throw new Error(users.err);
  const r = sql(
    `
    insert into public.agent_sessions (id, user_id, track, lang) values
      ('aaaaaaaa-0000-0000-0000-000000000001', null, 'war', 'en'),
      ('aaaaaaaa-0000-0000-0000-000000000002', '${USER_A}', 'foreign', 'vi');
    insert into public.agent_messages (session_id, role, content) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'user', 'anonymous question'),
      ('aaaaaaaa-0000-0000-0000-000000000002', 'user', 'question from A');
    insert into public.content_gaps (query) values ('a gap');
    `,
    { role: "service_role" },
  );
  if (!r.ok) throw new Error(r.err);
}

function applyMigrations(files: string[]) {
  for (const f of files) {
    const r = asPostgres(
      "psql",
      ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", dir, "-p", PORT, "-d", "app"],
      `set check_function_bodies = off;\n${stubbed(f)}`,
    );
    if (r.status !== 0) throw new Error(`${f}: ${r.stderr}`);
  }
}

function resetDb() {
  asPostgres("dropdb", ["-h", dir, "-p", PORT, "--if-exists", "app"]);
  asPostgres("createdb", ["-h", dir, "-p", PORT, "app"]);
  const r = asPostgres("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", dir, "-p", PORT, "-d", "app"], SUPABASE_STUBS);
  if (r.status !== 0) throw new Error(r.stderr);
}

describe.skipIf(!canRun)("row-level security (real Postgres)", () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "qt-pg-"));
    chmodSync(dir, 0o777);
    execFileSync(AS_POSTGRES[0], [...AS_POSTGRES.slice(1), join(PG_BIN, "initdb"), "-D", join(dir, "data"), "-A", "trust", "-U", "postgres"], {
      stdio: "ignore",
    });
    // The data dir belongs to postgres, so write the config through it too.
    asPostgres("sh", ["-c", `printf "port = ${PORT}\\nunix_socket_directories = '${dir}'\\nlisten_addresses = ''\\n" >> ${join(dir, "data", "postgresql.auto.conf")}`]);
    execFileSync(AS_POSTGRES[0], [...AS_POSTGRES.slice(1), join(PG_BIN, "pg_ctl"), "-D", join(dir, "data"), "-w", "start", "-l", join(dir, "log")], {
      stdio: "ignore",
    });
  }, 60_000);

  afterAll(() => {
    if (!dir) return;
    asPostgres(join(PG_BIN, "pg_ctl"), ["-D", join(dir, "data"), "-m", "immediate", "stop"]);
    // Files inside belong to postgres; remove them as postgres, then the (world-writable) dir.
    asPostgres("rm", ["-rf", join(dir, "data"), join(dir, "log")]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("0001 alone leaks anonymous sessions to any client (the bug 0003 fixes)", () => {
    resetDb();
    applyMigrations(["0001_init.sql", "0002_content_review.sql"]);
    seed();
    expect(sql("select count(*) from public.agent_sessions;", { role: "anon" }).out).toBe("1");
    expect(sql("select count(*) from public.agent_messages;", { role: "authenticated", uid: USER_B }).out).toBe("1");
  });

  describe("after 0003", () => {
    beforeAll(() => {
      resetDb();
      applyMigrations(["0001_init.sql", "0002_content_review.sql", "0003_rls_hardening.sql"]);
      seed();
    });

    it("hides every session and message from anon", () => {
      expect(sql("select count(*) from public.agent_sessions;", { role: "anon" }).out).toBe("0");
      expect(sql("select count(*) from public.agent_messages;", { role: "anon" }).out).toBe("0");
      expect(
        sql(`insert into public.agent_sessions (track, lang) values ('war', 'en');`, { role: "anon" }).ok,
      ).toBe(false);
    });

    it("shows a signed-in user only their own sessions and messages", () => {
      expect(sql("select count(*) from public.agent_sessions;", { role: "authenticated", uid: USER_A }).out).toBe("1");
      expect(sql("select content from public.agent_messages;", { role: "authenticated", uid: USER_A }).out).toBe(
        "question from A",
      );
      expect(sql("select count(*) from public.agent_sessions;", { role: "authenticated", uid: USER_B }).out).toBe("0");
    });

    it("stops users writing into other people's or anonymous sessions", () => {
      const asA = { role: "authenticated" as const, uid: USER_A };
      expect(sql(`insert into public.agent_sessions (user_id, track, lang) values ('${USER_B}', 'war', 'en');`, asA).ok).toBe(false);
      expect(
        sql(
          `insert into public.agent_messages (session_id, role, content) values ('aaaaaaaa-0000-0000-0000-000000000001', 'user', 'x');`,
          asA,
        ).ok,
      ).toBe(false);
      expect(sql(`insert into public.agent_sessions (user_id, track, lang) values ('${USER_A}', 'war', 'en');`, asA).ok).toBe(true);
    });

    it("lets a user delete their own sessions, and only those", () => {
      const r = sql(
        `delete from public.agent_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning id;`,
        { role: "authenticated", uid: USER_B },
      );
      expect(r.out).toBe("");
      const own = sql(
        `delete from public.agent_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning id;`,
        { role: "authenticated", uid: USER_A },
      );
      expect(own.out).toBe("aaaaaaaa-0000-0000-0000-000000000002");
    });

    it("keeps the catalogue public-read and server-write", () => {
      expect(sql("select count(*) from public.sites;", { role: "anon" }).ok).toBe(true);
      expect(
        sql(`insert into public.sites (slug, name_vi, name_en, type, geom) values ('x', 'x', 'x', 'war', 'p');`, {
          role: "anon",
        }).ok,
      ).toBe(false);
      expect(sql("delete from public.site_content;", { role: "authenticated", uid: USER_A }).out).toBe("");
    });

    it("keeps content_gaps server-only", () => {
      expect(sql("select count(*) from public.content_gaps;", { role: "anon" }).out).toBe("0");
      expect(sql("select count(*) from public.content_gaps;", { role: "service_role" }).out).toBe("1");
    });

    it("makes the write helpers service-role only", () => {
      const call = `select public.replace_site_content('00000000-0000-0000-0000-000000000000', 'en');`;
      expect(sql(call, { role: "anon" }).err).toMatch(/permission denied/);
      expect(sql(call, { role: "authenticated", uid: USER_A }).err).toMatch(/permission denied/);
      expect(sql(call, { role: "service_role" }).ok).toBe(true);
    });
  });
});
