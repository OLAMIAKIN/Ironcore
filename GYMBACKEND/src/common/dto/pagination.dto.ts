import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Every list endpoint is paginated; nothing returns an unbounded collection. */
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export function paginate<T>(
  items: T[],
  total: number,
  query: PaginationQuery,
): Paginated<T> {
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
