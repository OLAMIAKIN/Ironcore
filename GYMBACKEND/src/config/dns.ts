import * as dns from "dns";

/**
 * A local workaround, not a production setting.
 *
 * Some home and office networks run a resolver that cannot answer Atlas's SRV
 * records, so a `mongodb+srv://` string fails to resolve and every connection
 * attempt dies with `querySrv ECONNREFUSED`. Pointing at public resolvers fixes
 * that on those networks.
 *
 * A hosting platform resolves its own private names through its own DNS, so
 * overriding it there would break more than it fixes — hence the guard.
 *
 * Imported for its side effect by every entry point that talks to the database,
 * and it must be imported *before* anything opens a connection.
 */
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);
}
