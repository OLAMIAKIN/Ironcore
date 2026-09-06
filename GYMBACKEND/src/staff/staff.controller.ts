import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUser } from "@/common/types";
import { normalisePhone } from "@/common/utils/phone";
import { PasswordService } from "@/auth/password.service";
import { GymsService } from "@/gyms/gyms.service";
import { User, type UserDocument } from "@/users/schemas/user.schema";

class CreateStaffDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalisePhone(value) : value,
  )
  @Matches(/^0[789][01]\d{8}$/, { message: "Enter a valid phone number" })
  phone!: string;

  /** Managers and front desk only — a gym has exactly one owner. */
  @IsEnum(["manager", "scanner"])
  role!: "manager" | "scanner";

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class UpdateStaffDto {
  @IsEnum(["manager", "scanner"])
  role!: "manager" | "scanner";
}

@Controller("gyms/:gymId/staff")
export class StaffController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly passwords: PasswordService,
    private readonly gyms: GymsService,
  ) {}

  @Roles("owner")
  @Get()
  async list(@Param("gymId") gymId: string, @CurrentUser() user: AuthUser) {
    await this.gyms.requireStaffGym(gymId, user);

    const rows = await this.users
      .find({ gymId: new Types.ObjectId(gymId) })
      .sort({ role: 1, name: 1 })
      .lean();

    return {
      items: rows.map((row) => ({
        id: row._id.toString(),
        name: row.name,
        phone: row.phone,
        role: row.role,
        status: row.status,
        lastLoginAt: row.lastLoginAt,
      })),
    };
  }

  @Roles("owner")
  @Post()
  async create(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStaffDto,
  ) {
    const gym = await this.gyms.requireStaffGym(gymId, user);

    if (await this.users.exists({ phone: dto.phone })) {
      throw new ConflictException("That phone number already has an account");
    }

    const created = await this.users.create({
      name: dto.name.trim(),
      phone: dto.phone,
      role: dto.role,
      gymId: gym._id,
      passwordHash: await this.passwords.hash(dto.password),
    });

    return {
      id: created._id.toString(),
      name: created.name,
      phone: created.phone,
      role: created.role,
      status: created.status,
    };
  }

  @Roles("owner")
  @Patch(":staffId")
  async update(
    @Param("gymId") gymId: string,
    @Param("staffId") staffId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateStaffDto,
  ) {
    await this.gyms.requireStaffGym(gymId, user);

    // Scoped to this gym and to non-owner rows: an owner cannot be demoted,
    // and no one can reach into another gym's staff list.
    const updated = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(staffId),
        gymId: new Types.ObjectId(gymId),
        role: { $in: ["manager", "scanner"] },
      },
      { $set: { role: dto.role } },
      { new: true },
    );

    if (!updated) throw new ConflictException("Staff member not found");
    return { id: updated._id.toString(), role: updated.role };
  }

  /** Disabled rather than deleted, so their check-in history survives. */
  @Roles("owner")
  @Delete(":staffId")
  @HttpCode(204)
  async disable(
    @Param("gymId") gymId: string,
    @Param("staffId") staffId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.gyms.requireStaffGym(gymId, user);

    await this.users.updateOne(
      {
        _id: new Types.ObjectId(staffId),
        gymId: new Types.ObjectId(gymId),
        role: { $in: ["manager", "scanner"] },
      },
      { $set: { status: "disabled", tokenVersion: Date.now() % 100000 } },
    );
  }
}
