import * as dns from "dns";
import "reflect-metadata";

/**
 * A local workaround, not a production setting: some home and office networks
 * run a resolver that cannot answer Atlas's SRV records, which makes the
 * connection string fail to resolve. A hosting platform resolves its own
 * private names through its own DNS, so overriding it there would break more
 * than it fixes.
 */
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);
}
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express, { type Request, type Response } from "express";
import { AppModule } from "@/app.module";
import { corsOrigins, type Env } from "@/config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Trust the first proxy so req.ip is the caller, not the load balancer.
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const env = {
    NODE_ENV: config.getOrThrow<Env["NODE_ENV"]>("NODE_ENV"),
    PORT: config.getOrThrow<number>("PORT"),
    CORS_ORIGINS: config.getOrThrow<string>("CORS_ORIGINS"),
  } as Env;

  /**
   * Webhook signatures are computed over the exact bytes that were sent, so the
   * raw body is kept alongside the parsed one for that route only.
   */
  app.use(
    express.json({
      limit: "100kb",
      verify: (request: Request, _response: Response, buffer: Buffer) => {
        if (request.originalUrl.startsWith("/payments/webhook")) {
          (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(
            buffer,
          );
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(compression());
  app.use(cookieParser());
  app.set("trust proxy", 1);

  app.enableCors({
    origin: corsOrigins(env),
    credentials: true,
    // The CSRF header has to survive the preflight.
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (env.NODE_ENV !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("IronCore API")
        .setDescription("Gyms, memberships, payments and settlements")
        .setVersion("0.1")
        .build(),
    );
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(env.PORT);
  new Logger("Bootstrap").log(`API listening on http://localhost:${env.PORT}`);
}

void bootstrap();
