import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON;");
for (const file of readdirSync(new URL("../drizzle", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  sqlite.exec(
    readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"),
  );
class Statement {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    if (params.length > 100)
      throw new Error("D1 bound parameter limit exceeded");
    return new Statement(this.sql, params);
  }
  async raw() {
    const s = sqlite.prepare(this.sql);
    s.setReturnArrays(true);
    return s.all(...this.params);
  }
  async all() {
    const results = sqlite.prepare(this.sql).all(...this.params);
    return {
      results,
      success: true,
      meta: { changes: sqlite.prepare("select changes() n").get().n },
    };
  }
  async run() {
    return this.all();
  }
}
const objects = new Map();
export const env = {
  DB: {
    prepare: (sql) => new Statement(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  },
  BUCKET: {
    put: async (key, value) => {
      objects.set(key, new Uint8Array(value));
    },
    get: async (key) => {
      const value = objects.get(key);
      return value ? { arrayBuffer: async () => value.buffer } : null;
    },
  },
};
