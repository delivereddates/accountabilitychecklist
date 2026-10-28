import { TodosClient } from "@/components/todos/TodosClient";

// Static shell: TodosClient resolves the user id client-side (localStorage
// cache + /api/me), so this page prerenders and the navbar link prefetches
// fully — switching sections never waits on a server render.
export default function TodosPage() {
  return <TodosClient />;
}
