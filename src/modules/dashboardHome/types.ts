// tasks/{id}: personal to-dos shown on the daily dashboard.
export interface Task {
  id: string;
  ownerUid: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  done: boolean;
  createdAt: string;
}
