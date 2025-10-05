import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class TaskFilterDto {
  @ApiProperty({ enum: TaskStatus, required: false })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDateFrom?: Date;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDateTo?: Date;

  @ApiProperty({ required: false, default: 1 })
  @IsNumber()
  @IsOptional()
  page: number;

  @ApiProperty({ required: false, default: 10 })
  @IsNumber()
  @IsOptional()
  limit: number;
}
