import { currentUserId } from "@/lib/auth-server";
import { TodosClient } from "@/components/todos/TodosClient";

export default async function TodosPage() {
  const userId = await currentUserId();
  if (!userId) return null; // middleware guarantees a session; defensive
  return <TodosClient userId={userId} />;
}
