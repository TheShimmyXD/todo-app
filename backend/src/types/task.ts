// Shape of a task as the API returns it. Column names are snake_case in the database
// and camelCase here; the SQL in src/db/tasks.ts does the renaming with aliases.
export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
}
