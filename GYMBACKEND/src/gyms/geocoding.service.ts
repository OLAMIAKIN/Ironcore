import { Injectable, Logger } from "@nestjs/common";

/**
 * Turning an address into a point, via Nominatim — OpenStreetMap's own
 * geocoder. Free, no key, no account, which is what keeps this deployable on a
 * free tier.
 *
 * Two rules come with that, and both are honoured here: identify yourself with
 * a real User-Agent, and stay under roughly one request a second. Placing a
 * gym's pin happens a handful of times in a gym's life, so the ceiling is
 * generous — but a shared cache and a small queue keep a burst of typing from
 * turning into a burst of requests.
 */

export type GeocodeHit = {
  /** The address as Nominatim understands it, for the owner to confirm. */
  label: string;
  lat: number;
  lng: number;
};

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Their published limit is 1 req/s; leave headroom. */
const MIN_GAP_MS = 1200;

const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger("Geocoding");
  private readonly cache = new Map<
    string,
    { at: number; hits: GeocodeHit[] }
  >();

  /** Serialises calls so two people searching at once still go out one at a time. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  async search(query: string, limit = 5): Promise<GeocodeHit[]> {
    const key = `${query.trim().toLowerCase()}|${limit}`;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.hits;

    const hits = await this.enqueue(() => this.call(query, limit));
    this.cache.set(key, { at: Date.now(), hits });
    return hits;
  }

  /**
   * A best-effort pin for a gym that has just been created, from the only
   * address parts sign-up collects. Never throws: a gym that cannot be placed
   * is still a perfectly good gym, it just will not show under "near me" until
   * its owner sets the pin themselves.
   */
  async locate(parts: {
    branch: string;
    area: string;
  }): Promise<{ lat: number; lng: number } | null> {
    /**
     * Most specific first, then progressively vaguer. Nigerian local-government
     * names in particular often defeat the geocoder while the neighbourhood on
     * its own resolves cleanly — "Obawole, Ifako Ijaiye" finds nothing, plain
     * "Obawole" lands on the right street.
     */
    const attempts = [
      `${parts.branch}, ${parts.area}`,
      parts.branch,
      parts.area,
    ]
      .map((value) => value.trim())
      .filter((value, index, all) => value !== "" && all.indexOf(value) === index);

    for (const attempt of attempts) {
      try {
        const [best] = await this.search(attempt, 1);
        if (best) return { lat: best.lat, lng: best.lng };
      } catch {
        // Try the next, vaguer form.
      }
    }

    return null;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = MIN_GAP_MS - (Date.now() - this.lastCall);
      if (wait > 0) await new Promise((done) => setTimeout(done, wait));
      this.lastCall = Date.now();
      return work();
    });

    // The chain must survive a rejection or every later search inherits it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async call(query: string, limit: number): Promise<GeocodeHit[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", String(limit));
    // Nigeria only: a gym in Lagos should never resolve to a street in Ohio.
    url.searchParams.set("countrycodes", "ng");
    url.searchParams.set("addressdetails", "0");

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "IronCore/0.1 (gym directory; contact via app owner)",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim replied ${response.status}`);
        return [];
      }

      const rows = (await response.json()) as {
        display_name?: string;
        lat?: string;
        lon?: string;
      }[];

      return rows
        .map((row) => ({
          label: row.display_name ?? "",
          lat: Number(row.lat),
          lng: Number(row.lon),
        }))
        .filter(
          (hit) =>
            hit.label !== "" &&
            Number.isFinite(hit.lat) &&
            Number.isFinite(hit.lng),
        );
    } catch (cause: unknown) {
      // A geocoder being slow or down is not a reason to fail the screen that
      // called it; the owner can still drop the pin by hand.
      this.logger.warn(`Address lookup failed: ${String(cause)}`);
      return [];
    }
  }
}
