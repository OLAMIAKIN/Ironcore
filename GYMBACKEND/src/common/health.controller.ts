import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { Public } from "@/common/decorators/public.decorator";
import { SkipThrottle } from "@nestjs/throttler";

/**
 * What a platform's health check hits. It has to be public and unthrottled:
 * a probe carries no session, and a host that checks every few seconds would
 * otherwise rate-limit itself out of the service it is watching.
 */
@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @SkipThrottle()
  @Get()
  check() {
    // 1 is mongoose's "connected". Anything else and the API is up but useless,
    // which is worth saying out loud rather than reporting a bare "ok".
    const database = this.connection.readyState === 1 ? "up" : "down";

    return {
      status: database === "up" ? "ok" : "degraded",
      database,
      uptime: Math.round(process.uptime()),
    };
  }
}
