import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function connect() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required at runtime.");
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
export type DB = ReturnType<typeof connect>;
let connection: DB | undefined;
// Production builds need no database credentials; connect only for an actual data operation.
export const db = new Proxy({} as DB, {
  get(_target, property) {
    connection ??= connect();
    const value = Reflect.get(connection, property);
    return typeof value === "function" ? value.bind(connection) : value;
  },
});
