import { ApiProperty } from '@nestjs/swagger';

export class TaskBatchDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000'],
  })
  tasks: string[];

  @ApiProperty({
    example: 'complete',
    description: 'Action to perform on the tasks (e.g., complete, delete)',
  })
  action: string;
}
